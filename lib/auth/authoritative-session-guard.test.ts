import assert from "node:assert/strict";
import test from "node:test";
import {
  ANONYMOUS_INVALID_AUTH_SESSION,
  ANONYMOUS_MISSING_AUTH_SESSION,
  UNAVAILABLE_AUTH_SESSION,
  createAuthoritativeSessionGuard,
  isAuthenticatedAuthoritativeSession,
  isAuthoritativeSessionUnavailable,
  type AuthoritativeSessionGuardDependencies,
} from "./authoritative-session-guard";
import type { AuthSessionClaimsV2 } from "./session-claims-edge";

const ACTIVE_COOKIE_NAME = "next-auth.v2.session-token";
const TOKEN = "encrypted-v2-jwe";
const CLAIMS: Readonly<AuthSessionClaimsV2> = Object.freeze({
  sv: 2,
  sub: "user-1",
  sid: "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA",
  ur: 3,
  pr: 4,
  sat: 10_000,
  sae: 10_060,
});

const PRINCIPAL = {
  id: "user-1",
  email: "user@example.invalid",
  firstName: "Current",
  lastName: "User",
  name: "ignored dependency display name",
  role: "CUSTOMER" as const,
  requiresEmailVerification: false,
};

function cookie(value = TOKEN) {
  return [{ name: ACTIVE_COOKIE_NAME, value }];
}

function createDependencies(
  overrides: Partial<AuthoritativeSessionGuardDependencies> = {},
) {
  const events: string[] = [];
  const reports: unknown[] = [];
  const dependencies: AuthoritativeSessionGuardDependencies = {
    secret: "guard-secret-with-at-least-32-bytes",
    activeCookieName: ACTIVE_COOKIE_NAME,
    async decode(input) {
      events.push(`decode:${input.token}`);
      assert.equal(input.secret, "guard-secret-with-at-least-32-bytes");
      return CLAIMS;
    },
    async validate(input) {
      events.push(`validate:${input.sub}`);
      return { status: "valid", principal: PRINCIPAL };
    },
    report(event) {
      reports.push(event);
    },
    ...overrides,
  };
  return { dependencies, events, reports };
}

test("missing and structurally invalid cookies do not reach decoder or database", async () => {
  const harness = createDependencies();
  const guard = createAuthoritativeSessionGuard(harness.dependencies);

  assert.equal(await guard.resolve([]), ANONYMOUS_MISSING_AUTH_SESSION);
  assert.equal(await guard.resolve(cookie("")), ANONYMOUS_INVALID_AUTH_SESSION);
  assert.deepEqual(harness.events, []);
  assert.deepEqual(harness.reports, []);
});

test("guard decodes then validates and projects only the fresh normalized principal", async () => {
  const harness = createDependencies({
    async decode() {
      harness.events.push("decode");
      return {
        ...CLAIMS,
        role: "ADMIN",
        id: "stale-token-id",
        secret: "never-project",
      } as unknown as AuthSessionClaimsV2;
    },
    async validate(input) {
      harness.events.push(`validate:${input.sub}`);
      return {
        status: "valid" as const,
        principal: { ...PRINCIPAL, internalOnly: "never-project" },
      };
    },
  });
  const guard = createAuthoritativeSessionGuard(harness.dependencies);

  const resolution = await guard.resolve(cookie());

  assert.equal(isAuthenticatedAuthoritativeSession(resolution), true);
  if (!isAuthenticatedAuthoritativeSession(resolution)) return;
  assert.deepEqual(harness.events, ["decode", "validate:user-1"]);
  assert.deepEqual(resolution.principal, {
    id: "user-1",
    email: "user@example.invalid",
    firstName: "Current",
    lastName: "User",
    name: "Current User",
    role: "CUSTOMER",
    requiresEmailVerification: false,
  });
  assert.deepEqual(Object.keys(resolution.principal).sort(), [
    "email",
    "firstName",
    "id",
    "lastName",
    "name",
    "requiresEmailVerification",
    "role",
  ]);
  assert.equal(Object.isFrozen(resolution), true);
  assert.equal(Object.isFrozen(resolution.principal), true);
  assert.equal("sid" in resolution.principal, false);
  assert.equal("secret" in resolution.principal, false);
  assert.equal("internalOnly" in resolution.principal, false);
});

test("decode null or exception is anonymous invalid and never reaches validation", async () => {
  for (const decode of [
    async () => null,
    async () =>
      new Proxy(
        {},
        {
          get(): never {
            throw new Error("private decoded getter failure");
          },
        },
      ),
    async () => {
      throw new Error("private decoder failure");
    },
  ]) {
    let validationCalls = 0;
    const harness = createDependencies({
      decode,
      async validate() {
        validationCalls += 1;
        return { status: "valid", principal: PRINCIPAL };
      },
    });

    assert.equal(
      await createAuthoritativeSessionGuard(harness.dependencies).resolve(cookie()),
      ANONYMOUS_INVALID_AUTH_SESSION,
    );
    assert.equal(validationCalls, 0);
    assert.deepEqual(harness.reports, []);
  }
});

test("invalid database result is anonymous while unavailable, thrown and malformed valid results fail closed", async () => {
  const cases: Array<{
    validate: AuthoritativeSessionGuardDependencies["validate"];
    expected: "anonymous" | "unavailable";
  }> = [
    {
      async validate() {
        return { status: "invalid" };
      },
      expected: "anonymous",
    },
    {
      async validate() {
        return { status: "unavailable" };
      },
      expected: "unavailable",
    },
    {
      async validate() {
        throw new Error("private database failure");
      },
      expected: "unavailable",
    },
    {
      async validate() {
        return {
          status: "valid",
          principal: { ...PRINCIPAL, role: "NOT_A_ROLE" },
        } as never;
      },
      expected: "unavailable",
    },
    {
      async validate() {
        return { status: "unexpected" } as never;
      },
      expected: "unavailable",
    },
  ];

  for (const current of cases) {
    const harness = createDependencies({ validate: current.validate });
    const resolution = await createAuthoritativeSessionGuard(
      harness.dependencies,
    ).resolve(cookie());

    assert.equal(resolution.status, current.expected);
    if (current.expected === "anonymous") {
      assert.equal(resolution, ANONYMOUS_INVALID_AUTH_SESSION);
      assert.deepEqual(harness.reports, []);
    } else {
      assert.equal(resolution, UNAVAILABLE_AUTH_SESSION);
      assert.equal(isAuthoritativeSessionUnavailable(resolution), true);
      assert.deepEqual(harness.reports, [{ stage: "VALIDATION_UNAVAILABLE" }]);
    }
  }
});

test("reporter exceptions never alter an unavailable resolution or expose private details", async () => {
  const guard = createAuthoritativeSessionGuard({
    ...createDependencies().dependencies,
    async validate() {
      throw new Error("private adapter detail");
    },
    report() {
      throw new Error("private reporter detail");
    },
  });

  const resolution = await guard.resolve(cookie());

  assert.equal(resolution, UNAVAILABLE_AUTH_SESSION);
  assert.equal(Object.isFrozen(ANONYMOUS_MISSING_AUTH_SESSION), true);
  assert.equal(Object.isFrozen(ANONYMOUS_INVALID_AUTH_SESSION), true);
  assert.equal(Object.isFrozen(UNAVAILABLE_AUTH_SESSION), true);
  assert.equal(JSON.stringify(resolution).includes("private"), false);
  assert.equal(JSON.stringify(resolution).includes(CLAIMS.sid), false);
});
