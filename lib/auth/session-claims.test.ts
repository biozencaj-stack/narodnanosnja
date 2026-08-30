import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS,
  AUTH_SESSION_SID_BYTES,
  AuthSessionClaimsError,
  createAuthSessionClaimsV2,
  createAuthSessionStorageKey,
  generateAuthSessionSid,
  isAuthSessionClaimsExpired,
  isAuthSessionStorageKey,
  normalizeAuthSessionSid,
  parseAuthSessionClaimsV2,
} from "./session-claims";

const SECRET = "session-hmac-secret-with-at-least-32-bytes";
const SID = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";
const ISSUED_AT = new Date("2026-08-30T12:00:00.000Z");
const EXPIRES_AT = new Date("2026-08-31T12:00:00.000Z");

function createClaims() {
  return createAuthSessionClaimsV2({
    sub: "user-1",
    sid: SID,
    ur: 0,
    pr: 1,
    issuedAt: ISSUED_AT,
    absoluteExpiresAt: EXPIRES_AT,
  });
}

test("SID generator returns independent canonical unpadded 32-byte base64url values", () => {
  const sids = Array.from({ length: 32 }, () => generateAuthSessionSid());

  for (const sid of sids) {
    assert.match(sid, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(sid, "base64url").byteLength, AUTH_SESSION_SID_BYTES);
    assert.equal(normalizeAuthSessionSid(sid), sid);
  }
  assert.equal(new Set(sids).size, sids.length);
});

test("SID parser accepts only exact canonical base64url without padding or coercion", () => {
  assert.equal(normalizeAuthSessionSid(SID), SID);

  for (const invalid of [
    null,
    undefined,
    1,
    {},
    "",
    SID.slice(0, -1),
    `${SID}A`,
    ` ${SID}`,
    `${SID} `,
    `${SID}=`,
    `${SID.slice(0, -1)}+`,
    `${SID.slice(0, -1)}B`,
  ]) {
    assert.equal(normalizeAuthSessionSid(invalid), null, String(invalid));
  }
});

test("storage key is deterministic, HMAC-only and domain-separated", () => {
  const active = createAuthSessionStorageKey(SECRET, SID);
  const repeated = createAuthSessionStorageKey(SECRET, SID);
  const changedSecret = createAuthSessionStorageKey(
    `${SECRET}-changed`,
    SID,
  );
  const changedSid = createAuthSessionStorageKey(
    SECRET,
    "AgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICE",
  );

  assert.ok(active);
  assert.equal(active, repeated);
  assert.equal(
    active,
    "v1:b8d234bd357b8a1ee4ef53f4607eecfd73aca867ca534b431367b354e299d692",
  );
  assert.notEqual(active, changedSecret);
  assert.notEqual(active, changedSid);
  assert.match(active, /^v1:[0-9a-f]{64}$/);
  assert.equal(active.includes(SID), false);
  assert.equal(isAuthSessionStorageKey(active), true);
});

test("storage key rejects malformed SID and fails closed for short secrets", () => {
  for (const invalidSid of [null, "", `${SID}=`, `${SID.slice(0, -1)}B`]) {
    assert.equal(createAuthSessionStorageKey(SECRET, invalidSid), null);
  }
  assert.throws(
    () => createAuthSessionStorageKey("short-secret", SID),
    AuthSessionClaimsError,
  );

  for (const invalidKey of [
    SID,
    "v1:ABCDEF".padEnd(67, "A"),
    `v2:${"a".repeat(64)}`,
    `v1:${"a".repeat(63)}`,
    `v1:${"a".repeat(65)}`,
  ]) {
    assert.equal(isAuthSessionStorageKey(invalidKey), false);
  }
});

test("claims have the exact V2 shape and retain their supplied absolute expiry", () => {
  const claims = createClaims();

  assert.deepEqual(claims, {
    sv: 2,
    sub: "user-1",
    sid: SID,
    ur: 0,
    pr: 1,
    sat: 1_788_091_200,
    sae: 1_788_177_600,
  });
  assert.equal(Object.isFrozen(claims), true);
  assert.throws(() => {
    (claims as { sae: number }).sae += 1;
  }, TypeError);

  const parsed = parseAuthSessionClaimsV2({ ...claims });
  assert.ok(parsed);
  assert.equal(parsed.sae, claims.sae);
  assert.equal(parsed.sae - parsed.sat, AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS);
});

test("claims reject malformed shape, unsafe revisions, rolling expiry and non-whole-second dates", () => {
  const claims = createClaims();
  const malformed = [
    null,
    [],
    { ...claims, extra: true },
    { ...claims, sv: 1 },
    { ...claims, sub: "" },
    { ...claims, sub: `user\0one` },
    { ...claims, sub: "u".repeat(192) },
    { ...claims, sid: `${SID}=` },
    { ...claims, ur: -1 },
    { ...claims, ur: Number.MAX_SAFE_INTEGER + 1 },
    { ...claims, pr: 0 },
    { ...claims, sat: 1.5 },
    { ...claims, sae: claims.sat },
    { ...claims, sae: claims.sae + 1 },
  ];

  for (const value of malformed) {
    assert.equal(parseAuthSessionClaimsV2(value), null);
  }

  assert.throws(
    () =>
      createAuthSessionClaimsV2({
        sub: "user-1",
        sid: SID,
        ur: 0,
        pr: 1,
        issuedAt: new Date("2026-08-30T12:00:00.001Z"),
        absoluteExpiresAt: EXPIRES_AT,
      }),
    AuthSessionClaimsError,
  );
});

test("expiry has no grace: now >= sae is expired", () => {
  const claims = createClaims();

  assert.equal(isAuthSessionClaimsExpired(claims, claims.sae - 1), false);
  assert.equal(isAuthSessionClaimsExpired(claims, claims.sae), true);
  assert.equal(isAuthSessionClaimsExpired(claims, claims.sae + 1), true);
  assert.throws(
    () => isAuthSessionClaimsExpired(claims, 1.5),
    AuthSessionClaimsError,
  );
});
