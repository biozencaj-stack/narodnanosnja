import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  AuthConfigurationError,
  authSessionCookieName,
  resolveAuthSecret,
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

test("auth cookie security follows the canonical NextAuth URL", () => {
  const secureEnvironment = { NEXTAUTH_URL: "https://shop.example.com" };
  const localEnvironment = { NEXTAUTH_URL: "http://127.0.0.1:3000" };

  assert.equal(shouldUseSecureAuthCookies(secureEnvironment), true);
  assert.equal(
    authSessionCookieName(secureEnvironment),
    "__Secure-next-auth.session-token",
  );
  assert.equal(shouldUseSecureAuthCookies(localEnvironment), false);
  assert.equal(
    authSessionCookieName(localEnvironment),
    "next-auth.session-token",
  );
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
