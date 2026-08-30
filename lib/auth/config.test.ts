import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_SESSION_COOKIE_BASE_NAMES,
  AUTH_SESSION_MAX_AGE_SECONDS,
  AuthConfigurationError,
  authSessionCookieName,
  authSessionV2CookieName,
  resolveAuthSecret,
  resolveVerifiedLoginGraceDeadline,
  resolveVerifiedLoginPolicy,
  shouldUseSecureAuthCookies,
} from "./config";

const VALID_SECRET = "auth-secret-with-at-least-32-bytes";

test("auth secret fails closed when it is missing, blank, or too short", () => {
  for (const NEXTAUTH_SECRET of [undefined, "", "   ", "prekratko"]) {
    assert.throws(
      () => resolveAuthSecret({ NEXTAUTH_SECRET }),
      AuthConfigurationError,
    );
  }
});

test("auth secret rejects ambiguous surrounding whitespace", () => {
  assert.throws(
    () => resolveAuthSecret({ NEXTAUTH_SECRET: ` ${VALID_SECRET}` }),
    AuthConfigurationError,
  );
  assert.throws(
    () => resolveAuthSecret({ NEXTAUTH_SECRET: `${VALID_SECRET}\n` }),
    AuthConfigurationError,
  );
});

test("auth secret accepts a stable value with at least 32 UTF-8 bytes", () => {
  assert.equal(
    resolveAuthSecret({ NEXTAUTH_SECRET: VALID_SECRET }),
    VALID_SECRET,
  );
  assert.equal(
    resolveAuthSecret({ NEXTAUTH_SECRET: "š".repeat(16) }),
    "š".repeat(16),
  );
});

test("auth secret rejects known example placeholders", () => {
  assert.throws(
    () =>
      resolveAuthSecret({
        NEXTAUTH_SECRET:
          "promeni-me-nasumicnim-nizom-od-najmanje-32-bajta",
      }),
    AuthConfigurationError,
  );
});

test("auth session lifetime is exactly one day", () => {
  assert.equal(AUTH_SESSION_MAX_AGE_SECONDS, 86_400);
});

test("verified-login policy defaults to audit only outside production", () => {
  assert.equal(resolveVerifiedLoginPolicy({}), "audit");
  assert.equal(
    resolveVerifiedLoginPolicy({ NODE_ENV: "development" }),
    "audit",
  );
  assert.equal(resolveVerifiedLoginPolicy({ NODE_ENV: "test" }), "audit");

  assert.throws(
    () => resolveVerifiedLoginPolicy({ NODE_ENV: "production" }),
    AuthConfigurationError,
  );
});

test("verified-login policy accepts only the three exact values", () => {
  for (const policy of ["audit", "staged", "strict"] as const) {
    assert.equal(
      resolveVerifiedLoginPolicy({
        NODE_ENV: "production",
        AUTH_VERIFIED_LOGIN_POLICY: policy,
      }),
      policy,
    );
  }
});

test("verified-login policy rejects blank, padded, mixed-case and unknown values", () => {
  for (const configuredPolicy of [
    "",
    " ",
    " audit",
    "audit ",
    "AUDIT",
    "Staged",
    "disabled",
  ]) {
    assert.throws(
      () =>
        resolveVerifiedLoginPolicy({
          NODE_ENV: "production",
          AUTH_VERIFIED_LOGIN_POLICY: configuredPolicy,
        }),
      AuthConfigurationError,
      configuredPolicy,
    );
  }

  assert.throws(
    () =>
      resolveVerifiedLoginPolicy({
        NODE_ENV: "development",
        AUTH_VERIFIED_LOGIN_POLICY: "",
      }),
    AuthConfigurationError,
  );
});

test("staged verified-login requires one canonical UTC grace deadline", () => {
  const deadline = "2026-09-29T16:00:00.000Z";
  assert.equal(
    resolveVerifiedLoginGraceDeadline("staged", {
      AUTH_VERIFIED_LOGIN_GRACE_DEADLINE: deadline,
    })?.toISOString(),
    deadline,
  );
  assert.equal(resolveVerifiedLoginGraceDeadline("audit", {}), null);
  assert.equal(resolveVerifiedLoginGraceDeadline("strict", {}), null);
  assert.throws(
    () => resolveVerifiedLoginGraceDeadline("staged", {}),
    AuthConfigurationError,
  );
});

test("verified-login grace deadline rejects noncanonical or rounded input", () => {
  for (const value of [
    "2026-09-29",
    "2026-09-29T16:00:00Z",
    "2026-09-29 16:00:00.000Z",
    "2026-09-29T16:00:00.000+00:00",
    "2026-09-29T16:00:00.0000Z",
    "2026-02-30T16:00:00.000Z",
    " 2026-09-29T16:00:00.000Z",
  ]) {
    assert.throws(
      () =>
        resolveVerifiedLoginGraceDeadline("staged", {
          AUTH_VERIFIED_LOGIN_GRACE_DEADLINE: value,
        }),
      AuthConfigurationError,
      value,
    );
  }
});

test("auth cookie security follows the canonical NextAuth URL", () => {
  const secureEnvironment = { NEXTAUTH_URL: "https://shop.example.com" };
  const localEnvironment = { NEXTAUTH_URL: "http://127.0.0.1:3000" };

  assert.equal(shouldUseSecureAuthCookies(secureEnvironment), true);
  assert.equal(
    authSessionCookieName(secureEnvironment),
    "__Secure-next-auth.session-token",
  );
  assert.equal(
    authSessionV2CookieName(secureEnvironment),
    "__Secure-next-auth.v2.session-token",
  );
  assert.equal(shouldUseSecureAuthCookies(localEnvironment), false);
  assert.equal(
    authSessionCookieName(localEnvironment),
    "next-auth.session-token",
  );
  assert.equal(
    authSessionV2CookieName(localEnvironment),
    "next-auth.v2.session-token",
  );
});

test("auth cookie cleanup contract enumerates only the canonical legacy and V2 bases", () => {
  assert.equal(Object.isFrozen(AUTH_SESSION_COOKIE_BASE_NAMES), true);
  assert.deepEqual(AUTH_SESSION_COOKIE_BASE_NAMES, [
    "next-auth.v2.session-token",
    "__Secure-next-auth.v2.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ]);
});

test("auth cookie security fails closed for an invalid configured URL", () => {
  assert.throws(
    () => shouldUseSecureAuthCookies({ NEXTAUTH_URL: "ftp://shop.example.com" }),
    AuthConfigurationError,
  );
  assert.throws(
    () => shouldUseSecureAuthCookies({ NEXTAUTH_URL: " nije-url " }),
    AuthConfigurationError,
  );
  assert.throws(
    () =>
      shouldUseSecureAuthCookies({
        NEXTAUTH_URL: "http://shop.example.com",
        NODE_ENV: "production",
      }),
    AuthConfigurationError,
  );
  assert.throws(
    () => shouldUseSecureAuthCookies({ NODE_ENV: "production" }),
    AuthConfigurationError,
  );
  assert.equal(shouldUseSecureAuthCookies({ NODE_ENV: "development" }), false);
});
