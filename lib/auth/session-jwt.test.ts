import assert from "node:assert/strict";
import test from "node:test";
import type { JWT, JWTEncodeParams } from "next-auth/jwt";
import {
  AuthSessionJwtError,
  createAuthSessionJwtCodec,
  decodeAuthSessionJwt,
  encodeAuthSessionJwt,
  extractAuthSessionClaimsV2,
} from "./session-jwt";

const SECRET = "session-jwt-secret-with-at-least-32-bytes";
const SID = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";
const BASE_CLAIMS = {
  sv: 2 as const,
  sub: "user-1",
  sid: SID,
  ur: 4,
  pr: 7,
  sat: 1_000,
  sae: 1_000 + 86_400,
};

function jwt(value: Record<string, unknown>): JWT {
  return value as JWT;
}

test("extractor keeps only the seven reviewed V2 claims", () => {
  const extracted = extractAuthSessionClaimsV2({
    ...BASE_CLAIMS,
    iat: 123,
    exp: 456,
    jti: "next-auth-jti",
    role: "stale-role-must-not-be-persisted",
    principal: { id: "must-not-be-persisted" },
  });

  assert.deepEqual(extracted, BASE_CLAIMS);
  assert.equal(Object.isFrozen(extracted), true);
  assert.equal(extractAuthSessionClaimsV2({ ...BASE_CLAIMS, sv: 1 }), null);
  assert.equal(extractAuthSessionClaimsV2(null), null);
});

test("encode strips transient fields and caps JWE lifetime at original sae", async () => {
  const calls: JWTEncodeParams[] = [];
  const codec = createAuthSessionJwtCodec({
    nowEpochSeconds: () => 10_000,
    async encode(params) {
      calls.push(params);
      return "encoded-v2-session";
    },
  });
  const claims = { ...BASE_CLAIMS, sat: 9_000, sae: 10_120 };

  const result = await codec.encode({
    secret: SECRET,
    maxAge: 86_400,
    token: jwt({
      ...claims,
      role: "ADMIN",
      principal: { email: "private@example.invalid" },
    }),
  });

  assert.equal(result, "encoded-v2-session");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.maxAge, 120);
  assert.deepEqual(calls[0]?.token, claims);
  assert.equal("role" in (calls[0]?.token ?? {}), false);
  assert.equal("principal" in (calls[0]?.token ?? {}), false);
});

test("repeated encode shortens the remaining lifetime and never rolls sae", async () => {
  let now = 20_000;
  const observed: Array<{ maxAge: number | undefined; token: JWT | undefined }> = [];
  const codec = createAuthSessionJwtCodec({
    nowEpochSeconds: () => now,
    async encode(params) {
      observed.push({ maxAge: params.maxAge, token: params.token });
      return `encoded-${observed.length}`;
    },
  });
  const claims = { ...BASE_CLAIMS, sat: 19_000, sae: 20_100 };

  await codec.encode({
    secret: SECRET,
    maxAge: 86_400,
    token: jwt(claims),
  });
  now = 20_090;
  await codec.encode({
    secret: SECRET,
    maxAge: 86_400,
    token: jwt(claims),
  });

  assert.deepEqual(
    observed.map(({ maxAge }) => maxAge),
    [100, 10],
  );
  assert.deepEqual(
    observed.map(({ token }) => token?.sae),
    [20_100, 20_100],
  );
});

test("encode rejects malformed, expired and invalid maxAge input", async () => {
  const codec = createAuthSessionJwtCodec({
    nowEpochSeconds: () => 30_000,
    async encode() {
      throw new Error("must not reach encoder");
    },
  });

  await assert.rejects(
    codec.encode({ secret: SECRET, token: jwt({ sub: "legacy-user" }) }),
    AuthSessionJwtError,
  );
  await assert.rejects(
    codec.encode({
      secret: SECRET,
      token: jwt({ ...BASE_CLAIMS, sat: 29_000, sae: 30_000 }),
    }),
    AuthSessionJwtError,
  );
  await assert.rejects(
    codec.encode({
      secret: SECRET,
      maxAge: 0,
      token: jwt({ ...BASE_CLAIMS, sat: 29_000, sae: 30_001 }),
    }),
    AuthSessionJwtError,
  );
});

test("decode removes standard fields and enforces exact now >= sae expiry", async () => {
  let now = 40_099;
  const codec = createAuthSessionJwtCodec({
    nowEpochSeconds: () => now,
    async decode() {
      return jwt({
        ...BASE_CLAIMS,
        sat: 39_000,
        sae: 40_100,
        iat: 40_000,
        exp: 40_115,
        jti: "jti",
      });
    },
  });

  assert.deepEqual(await codec.decode({ secret: SECRET, token: "jwe" }), {
    ...BASE_CLAIMS,
    sat: 39_000,
    sae: 40_100,
  });
  now = 40_100;
  assert.equal(await codec.decode({ secret: SECRET, token: "jwe" }), null);
});

test("decode also removes NextAuth clock tolerance at the encrypted exp boundary", async () => {
  let now = 50_049;
  const codec = createAuthSessionJwtCodec({
    nowEpochSeconds: () => now,
    async decode() {
      return jwt({
        ...BASE_CLAIMS,
        sat: 49_000,
        sae: 50_100,
        exp: 50_050,
      });
    },
  });

  assert.ok(await codec.decode({ secret: SECRET, token: "jwe" }));
  now = 50_050;
  assert.equal(await codec.decode({ secret: SECRET, token: "jwe" }), null);
});

test("decode turns cryptographic and claim failures into a closed null", async () => {
  const throwingCodec = createAuthSessionJwtCodec({
    async decode() {
      throw new Error("private decrypt failure");
    },
  });
  const malformedCodec = createAuthSessionJwtCodec({
    nowEpochSeconds: () => 1,
    async decode() {
      return jwt({ sub: "legacy-user" });
    },
  });
  const invalidClockCodec = createAuthSessionJwtCodec({
    nowEpochSeconds: () => 1.5,
    async decode() {
      return jwt({ ...BASE_CLAIMS, exp: BASE_CLAIMS.sae });
    },
  });

  assert.equal(
    await throwingCodec.decode({ secret: SECRET, token: "private" }),
    null,
  );
  assert.equal(
    await malformedCodec.decode({ secret: SECRET, token: "legacy" }),
    null,
  );
  assert.equal(
    await invalidClockCodec.decode({ secret: SECRET, token: "clock" }),
    null,
  );
});

test("default NextAuth codec round-trip preserves immutable V2 claims", async () => {
  const now = Math.floor(Date.now() / 1_000);
  const claims = { ...BASE_CLAIMS, sat: now, sae: now + 60 };

  const encoded = await encodeAuthSessionJwt({
    secret: SECRET,
    maxAge: 86_400,
    token: jwt({ ...claims, role: "ADMIN" }),
  });
  const decoded = await decodeAuthSessionJwt({
    secret: SECRET,
    token: encoded,
  });

  assert.deepEqual(decoded, claims);
  assert.equal("role" in (decoded ?? {}), false);
  assert.equal("iat" in (decoded ?? {}), false);
  assert.equal("exp" in (decoded ?? {}), false);
});
