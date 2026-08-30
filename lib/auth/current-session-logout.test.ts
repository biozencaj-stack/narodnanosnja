import assert from "node:assert/strict";
import test from "node:test";
import {
  createCurrentSessionLogoutPlan,
  type CurrentSessionLogoutDependencies,
} from "./current-session-logout";
import { AUTH_SESSION_COOKIE_BASE_NAMES } from "./auth-session-cookie-cleanup";
import { createAuthSessionClaimsV2 } from "./session-claims";

const SID = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";

function claims() {
  return createAuthSessionClaimsV2({
    sub: "user-1",
    sid: SID,
    ur: 4,
    pr: 7,
    issuedAt: new Date("2026-08-30T12:00:00.000Z"),
    absoluteExpiresAt: new Date("2026-08-31T12:00:00.000Z"),
  });
}

function createDependencies(
  result: "revoked" | "invalid" | "unavailable",
  options: {
    throwRevoke?: boolean;
    throwReport?: boolean;
    unexpectedRevokeResult?: unknown;
  } = {},
) {
  const calls: unknown[] = [];
  const reports: unknown[] = [];
  const events: string[] = [];
  const dependencies: CurrentSessionLogoutDependencies = {
    async revokeCurrent(input) {
      calls.push(input);
      events.push("revoke");
      if (options.throwRevoke) throw new Error("private adapter failure");
      if (options.unexpectedRevokeResult !== undefined) {
        return options.unexpectedRevokeResult as never;
      }
      return result;
    },
    report(event) {
      reports.push(event);
      if (options.throwReport) throw new Error("private reporter failure");
    },
  };
  return { dependencies, calls, reports, events };
}

test("malformed and legacy input clears without touching the database", async () => {
  for (const tokenOrClaims of [
    null,
    { sub: "user-1" },
    { ...claims(), sv: 1 },
    { ...claims(), extra: true },
  ]) {
    const harness = createDependencies("revoked");
    const plan = await createCurrentSessionLogoutPlan(
      tokenOrClaims,
      [],
      harness.dependencies,
    );
    assert.equal(plan.disposition, "clear");
    assert.deepEqual(
      plan.cleanup.cookies.map((cookie) => cookie.name),
      AUTH_SESSION_COOKIE_BASE_NAMES,
    );
    assert.deepEqual(harness.calls, []);
    assert.deepEqual(harness.reports, []);
  }
});

test("a revoked or already-invalid exact V2 session permits cookie cleanup", async () => {
  for (const result of ["revoked", "invalid"] as const) {
    const harness = createDependencies(result);
    const plan = await createCurrentSessionLogoutPlan(
      { ...claims() },
      [],
      harness.dependencies,
    );
    assert.equal(plan.disposition, "clear");
    assert.equal(harness.calls.length, 1);
    assert.deepEqual(harness.reports, []);
  }
});

test("unavailable and thrown revoke outcomes require retry without cookie cleanup", async () => {
  for (const harness of [
    createDependencies("unavailable"),
    createDependencies("revoked", { throwRevoke: true }),
  ]) {
    const plan = await createCurrentSessionLogoutPlan(
      { ...claims() },
      [],
      harness.dependencies,
    );
    assert.equal(plan.disposition, "retry");
    assert.deepEqual(plan.cleanup.cookies, []);
    assert.equal(Object.isFrozen(plan.cleanup.cookies), true);
    assert.equal(harness.calls.length, 1);
    assert.deepEqual(harness.reports, [{ stage: "REVOKE_UNAVAILABLE" }]);
  }
});

test("a reporter failure never changes a fail-closed retry result or public data", async () => {
  const harness = createDependencies("unavailable", { throwReport: true });
  const result = await createCurrentSessionLogoutPlan(
    { ...claims() },
    [],
    harness.dependencies,
  );

  assert.equal(result.disposition, "retry");
  assert.deepEqual(harness.reports, [{ stage: "REVOKE_UNAVAILABLE" }]);
  assert.equal(JSON.stringify(result).includes(SID), false);
  assert.equal(JSON.stringify(result).includes("user-1"), false);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("combined plan revokes decoded V2 claims before creating cleanup descriptors", async () => {
  const harness = createDependencies("revoked");
  const observedCookie = {
    get name() {
      harness.events.push("cleanup");
      return "next-auth.v2.session-token.0";
    },
  };

  const plan = await createCurrentSessionLogoutPlan(
    { ...claims() },
    [observedCookie],
    harness.dependencies,
  );

  assert.equal(plan.disposition, "clear");
  assert.equal(plan.cleanup.hasRemainingRecognizedChunks, false);
  assert.ok(
    plan.cleanup.cookies.some(
      (cookie) => cookie.name === "next-auth.v2.session-token.0",
    ),
  );
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.events[0], "revoke");
  assert.ok(harness.events.slice(1).length > 0);
  assert.ok(harness.events.slice(1).every((event) => event === "cleanup"));
});

test("a raw encrypted-looking string is never treated as decoded V2 claims", async () => {
  const harness = createDependencies("revoked");
  const encryptedLookingCookie = "eyJhbGciOiJkaXIifQ.encrypted.payload";

  const plan = await createCurrentSessionLogoutPlan(
    encryptedLookingCookie,
    [],
    harness.dependencies,
  );

  assert.equal(plan.disposition, "clear");
  assert.deepEqual(harness.calls, []);
  assert.deepEqual(
    plan.cleanup.cookies.map((cookie) => cookie.name),
    AUTH_SESSION_COOKIE_BASE_NAMES,
  );
});

test("unavailable, thrown, and unexpected revoke outcomes never invoke cleanup", async () => {
  for (const harness of [
    createDependencies("unavailable"),
    createDependencies("revoked", { throwRevoke: true }),
    createDependencies("revoked", { unexpectedRevokeResult: "unexpected" }),
  ]) {
    let cleanupReads = 0;
    const plan = await createCurrentSessionLogoutPlan(
      { ...claims() },
      [
        {
          get name() {
            cleanupReads += 1;
            return "next-auth.v2.session-token";
          },
        },
      ],
      harness.dependencies,
    );
    assert.deepEqual(plan, {
      disposition: "retry",
      cleanup: { cookies: [], hasRemainingRecognizedChunks: false },
    });
    assert.equal(harness.calls.length, 1);
    assert.equal(cleanupReads, 0);
    assert.deepEqual(harness.reports, [{ stage: "REVOKE_UNAVAILABLE" }]);
  }
});

test("cleanup planning failure returns retry with exactly zero descriptors", async () => {
  const harness = createDependencies("invalid");
  let cleanupReads = 0;

  const plan = await createCurrentSessionLogoutPlan(
    { ...claims() },
    [
      {
        get name(): never {
          cleanupReads += 1;
          throw new Error("private cookie getter failure");
        },
      },
    ],
    harness.dependencies,
  );

  assert.deepEqual(plan, {
    disposition: "retry",
    cleanup: { cookies: [], hasRemainingRecognizedChunks: false },
  });
  assert.equal(harness.calls.length, 1);
  assert.equal(cleanupReads, 1);
  assert.equal(Object.isFrozen(plan.cleanup.cookies), true);
  assert.deepEqual(harness.reports, [
    { stage: "COOKIE_CLEANUP_UNAVAILABLE" },
  ]);
});
