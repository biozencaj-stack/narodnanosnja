import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_SESSION_COOKIE_BASE_NAMES,
  MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX,
  MAX_AUTH_SESSION_COOKIE_CLEANUPS,
  createAuthSessionCookieCleanup,
  createAuthSessionCookieCleanupPlan,
} from "./auth-session-cookie-cleanup";

test("cleanup always includes the four known legacy/V2 bases with exact deletion attributes", () => {
  const cleanup = createAuthSessionCookieCleanup([]);

  assert.deepEqual(
    cleanup.map((cookie) => cookie.name),
    AUTH_SESSION_COOKIE_BASE_NAMES,
  );
  for (const cookie of cleanup) {
    assert.equal(Object.isFrozen(cookie), true);
    assert.deepEqual(Object.keys(cookie).sort(), [
      "expires",
      "httpOnly",
      "maxAge",
      "name",
      "path",
      "sameSite",
      "secure",
      "value",
    ]);
    assert.equal(cookie.value, "");
    assert.equal(cookie.path, "/");
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.maxAge, 0);
    assert.equal(cookie.expires.getTime(), 0);
    assert.equal(cookie.secure, cookie.name.startsWith("__Secure-"));
    assert.equal("domain" in cookie, false);
  }
  assert.equal(Object.isFrozen(cleanup), true);
});

test("cleanup accepts only exact numeric chunks, deduplicates them and orders bases/chunks deterministically", () => {
  const cleanup = createAuthSessionCookieCleanup([
    { name: "next-auth.v2.session-token.10" },
    { name: "__Secure-next-auth.v2.session-token.1" },
    { name: "next-auth.v2.session-token.2" },
    { name: "next-auth.v2.session-token.0" },
    { name: "next-auth.v2.session-token.2" },
    { name: "next-auth.session-token.3" },
    { name: "__Secure-next-auth.session-token.0" },
  ]);

  assert.deepEqual(
    cleanup.map((cookie) => cookie.name),
    [
      "next-auth.v2.session-token",
      "next-auth.v2.session-token.0",
      "next-auth.v2.session-token.2",
      "next-auth.v2.session-token.10",
      "__Secure-next-auth.v2.session-token",
      "__Secure-next-auth.v2.session-token.1",
      "next-auth.session-token",
      "next-auth.session-token.3",
      "__Secure-next-auth.session-token",
      "__Secure-next-auth.session-token.0",
    ],
  );
});

test("cleanup rejects csrf, callback/order cookies, lookalikes and noncanonical chunks", () => {
  const cleanup = createAuthSessionCookieCleanup([
    { name: "next-auth.csrf-token" },
    { name: "next-auth.callback-url" },
    { name: "order-access-token" },
    { name: "next-auth.v2.session-token-lookalike.0" },
    { name: "next-auth.v2.session-token." },
    { name: "next-auth.v2.session-token.-1" },
    { name: "next-auth.v2.session-token.00" },
    { name: "next-auth.v2.session-token.1x" },
    { name: "__Secure-next-auth.session-token.01" },
    { name: "__Secure-next-auth.session-token.1.extra" },
    { name: 42 },
  ]);

  assert.deepEqual(
    cleanup.map((cookie) => cookie.name),
    AUTH_SESSION_COOKIE_BASE_NAMES,
  );
});

test("cleanup accepts the bounded canonical chunk-index ceiling and never reflects an oversized suffix", () => {
  const accepted = createAuthSessionCookieCleanup([
    { name: `next-auth.v2.session-token.${MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX}` },
  ]);
  assert.ok(
    accepted.some(
      (cookie) =>
        cookie.name ===
        `next-auth.v2.session-token.${MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX}`,
    ),
  );

  const oversized = "9".repeat(4_096);
  const rejected = createAuthSessionCookieCleanup([
    { name: `next-auth.v2.session-token.${oversized}` },
  ]);
  assert.equal(
    rejected.some((cookie) => cookie.name.includes(oversized)),
    false,
  );
  assert.deepEqual(
    rejected.map((cookie) => cookie.name),
    AUTH_SESSION_COOKIE_BASE_NAMES,
  );
});

test("cleanup caps each response but reports remaining recognized chunks for deterministic progress", () => {
  const chunkCapacity =
    MAX_AUTH_SESSION_COOKIE_CLEANUPS - AUTH_SESSION_COOKIE_BASE_NAMES.length;
  const requestCookies = Array.from(
    { length: chunkCapacity + 3 },
    (_, index) => ({ name: `next-auth.v2.session-token.${index}` }),
  );
  const first = createAuthSessionCookieCleanupPlan(requestCookies);

  assert.equal(first.cookies.length, MAX_AUTH_SESSION_COOKIE_CLEANUPS);
  assert.equal(first.hasRemainingRecognizedChunks, true);
  assert.deepEqual(
    first.cookies.map((cookie) => cookie.name).slice(0, 5),
    [
      "next-auth.v2.session-token",
      "next-auth.v2.session-token.0",
      "next-auth.v2.session-token.1",
      "next-auth.v2.session-token.2",
      "next-auth.v2.session-token.3",
    ],
  );

  const remainingRequest = requestCookies.slice(chunkCapacity);
  const second = createAuthSessionCookieCleanupPlan(remainingRequest);
  assert.equal(second.hasRemainingRecognizedChunks, false);
  assert.deepEqual(
    second.cookies.map((cookie) => cookie.name),
    [
      "next-auth.v2.session-token",
      `next-auth.v2.session-token.${chunkCapacity}`,
      `next-auth.v2.session-token.${chunkCapacity + 1}`,
      `next-auth.v2.session-token.${chunkCapacity + 2}`,
      "__Secure-next-auth.v2.session-token",
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
    ],
  );
});

test("cleanup enforces one global 32-descriptor cap across mixed known bases", () => {
  const firstBaseChunks = Array.from({ length: 20 }, (_, index) => ({
    name: `${AUTH_SESSION_COOKIE_BASE_NAMES[0]}.${index}`,
  }));
  const secondBaseChunks = Array.from({ length: 20 }, (_, index) => ({
    name: `${AUTH_SESSION_COOKIE_BASE_NAMES[1]}.${index}`,
  }));
  const plan = createAuthSessionCookieCleanupPlan(
    [...secondBaseChunks, ...firstBaseChunks].reverse(),
  );
  const names = plan.cookies.map((cookie) => cookie.name);

  assert.equal(plan.cookies.length, MAX_AUTH_SESSION_COOKIE_CLEANUPS);
  assert.equal(plan.hasRemainingRecognizedChunks, true);
  assert.equal(
    names.filter((name) =>
      name.startsWith(`${AUTH_SESSION_COOKIE_BASE_NAMES[0]}.`),
    ).length,
    20,
  );
  assert.equal(
    names.filter((name) =>
      name.startsWith(`${AUTH_SESSION_COOKIE_BASE_NAMES[1]}.`),
    ).length,
    8,
  );
  assert.ok(names.includes(`${AUTH_SESSION_COOKIE_BASE_NAMES[1]}.7`));
  assert.equal(names.includes(`${AUTH_SESSION_COOKIE_BASE_NAMES[1]}.8`), false);
});
