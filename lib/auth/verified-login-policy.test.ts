import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateVerifiedLoginPolicy,
  type VerifiedLoginPolicyState,
} from "./verified-login-policy";

const NOW = new Date("2026-08-30T16:00:00.000Z");
const STAGED_DEADLINE = new Date("2026-09-29T16:00:00.000Z");

function state(
  overrides: Partial<VerifiedLoginPolicyState> = {},
): VerifiedLoginPolicyState {
  return {
    policy: "staged",
    role: "CUSTOMER",
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    emailVerified: null,
    emailVerificationLoginGraceUntil: null,
    stagedGraceDeadline: STAGED_DEADLINE,
    evaluatedAt: NOW,
    ...overrides,
  };
}

test("a finite email verification timestamp is allowed in every policy", () => {
  for (const policy of ["audit", "staged", "strict"] as const) {
    assert.deepEqual(
      evaluateVerifiedLoginPolicy(
        state({
          policy,
          role: "ADMIN",
          emailVerified: new Date("2026-08-30T15:00:00.000Z"),
        }),
      ),
      {
        allowed: true,
        requiresEmailVerification: false,
        reason: "VERIFIED",
      },
    );
  }
});

test("verification timestamp may equal account creation or DB evaluation time", () => {
  for (const emailVerified of [
    new Date("2026-08-01T12:00:00.000Z"),
    new Date("2026-08-30T16:00:00.000Z"),
  ]) {
    assert.equal(
      evaluateVerifiedLoginPolicy(
        state({ policy: "strict", emailVerified }),
      ).allowed,
      true,
    );
  }
});

test("audit allows an unverified account but marks the strict requirement", () => {
  assert.deepEqual(
    evaluateVerifiedLoginPolicy(
      state({
        policy: "audit",
        role: "ADMIN",
        emailVerificationLoginGraceUntil: null,
      }),
    ),
    {
      allowed: true,
      requiresEmailVerification: true,
      reason: "AUDIT_WOULD_DENY",
    },
  );
});

test("staged allows only a customer with finite grace strictly after DB time", () => {
  assert.deepEqual(
    evaluateVerifiedLoginPolicy(
      state({
        emailVerificationLoginGraceUntil: new Date(
          "2026-09-29T16:00:00.000Z",
        ),
      }),
    ),
    {
      allowed: true,
      requiresEmailVerification: true,
      reason: "STAGED_GRACE_ACTIVE",
    },
  );

  for (const { graceUntil, deadline } of [
    { graceUntil: null, deadline: STAGED_DEADLINE },
    {
      graceUntil: new Date("2026-08-30T15:59:59.999Z"),
      deadline: new Date("2026-08-30T15:59:59.999Z"),
    },
    {
      graceUntil: new Date("2026-08-30T16:00:00.000Z"),
      deadline: new Date("2026-08-30T16:00:00.000Z"),
    },
  ]) {
    assert.deepEqual(
      evaluateVerifiedLoginPolicy(
        state({
          emailVerificationLoginGraceUntil: graceUntil,
          stagedGraceDeadline: deadline,
        }),
      ),
      {
        allowed: false,
        requiresEmailVerification: true,
        reason: "STAGED_VERIFICATION_REQUIRED",
      },
    );
  }
});

test("staged never lets staff bypass verification by grace", () => {
  for (const role of ["ADMIN", "OPERATOR"] as const) {
    assert.deepEqual(
      evaluateVerifiedLoginPolicy(
        state({
          role,
          emailVerificationLoginGraceUntil: new Date(
            "2026-09-29T16:00:00.000Z",
          ),
        }),
      ),
      {
        allowed: false,
        requiresEmailVerification: true,
        reason: "STAGED_VERIFICATION_REQUIRED",
      },
    );
  }
});

test("strict rejects every unverified account and ignores grace", () => {
  assert.deepEqual(
    evaluateVerifiedLoginPolicy(
      state({
        policy: "strict",
        emailVerificationLoginGraceUntil: new Date(
          "2027-08-30T16:00:00.000Z",
        ),
      }),
    ),
    {
      allowed: false,
      requiresEmailVerification: true,
      reason: "STRICT_VERIFICATION_REQUIRED",
    },
  );
});

test("verified account may ignore a valid active or expired grace value", () => {
  for (const graceUntil of [
    new Date("2026-08-29T16:00:00.000Z"),
    new Date("2026-09-30T16:00:00.000Z"),
  ]) {
    assert.equal(
      evaluateVerifiedLoginPolicy(
        state({
          policy: "strict",
          emailVerified: new Date("2026-08-30T15:00:00.000Z"),
          emailVerificationLoginGraceUntil: graceUntil,
        }),
      ).allowed,
      true,
    );
  }
});

test("verified account still requires valid DB clock, role and grace metadata", () => {
  const emailVerified = new Date("2026-08-30T15:00:00.000Z");

  for (const overrides of [
    { evaluatedAt: new Date(Number.NaN) },
    { role: "NEPOZNATA" },
    { emailVerificationLoginGraceUntil: new Date(Number.NaN) },
  ]) {
    assert.throws(() =>
      evaluateVerifiedLoginPolicy(
        state({ policy: "strict", emailVerified, ...overrides }),
      ),
    );
  }
});

test("invalid role, account clock or policy clock throws before every policy", () => {
  for (const policy of ["audit", "staged", "strict"] as const) {
    for (const overrides of [
      { role: "NEPOZNATA" },
      { createdAt: new Date(Number.NaN) },
      { evaluatedAt: new Date(Number.NaN) },
      { createdAt: new Date("2026-08-30T16:00:00.001Z") },
    ]) {
      assert.throws(() =>
        evaluateVerifiedLoginPolicy(state({ policy, ...overrides })),
      );
    }
  }
});

test("invalid or chronologically impossible verification timestamp always throws", () => {
  for (const policy of ["audit", "staged", "strict"] as const) {
    for (const emailVerified of [
      new Date(Number.NaN),
      new Date("2026-08-01T11:59:59.999Z"),
      new Date("2026-08-30T16:00:00.001Z"),
    ]) {
      assert.throws(() =>
        evaluateVerifiedLoginPolicy(state({ policy, emailVerified })),
      );
    }
  }
});

test("non-null invalid grace throws before audit or staged can allow", () => {
  for (const policy of ["audit", "staged", "strict"] as const) {
    assert.throws(() =>
      evaluateVerifiedLoginPolicy(
        state({
          policy,
          emailVerificationLoginGraceUntil: new Date(Number.NaN),
        }),
      ),
    );
  }
});

test("staged fails closed for a mismatched or overlong rollout deadline", () => {
  assert.throws(() =>
    evaluateVerifiedLoginPolicy(
      state({
        emailVerificationLoginGraceUntil: new Date(
          "2026-09-28T16:00:00.000Z",
        ),
      }),
    ),
  );
  assert.throws(() =>
    evaluateVerifiedLoginPolicy(
      state({
        stagedGraceDeadline: new Date("2026-09-29T16:00:00.001Z"),
        emailVerificationLoginGraceUntil: new Date(
          "2026-09-29T16:00:00.001Z",
        ),
      }),
    ),
  );
  assert.throws(() =>
    evaluateVerifiedLoginPolicy(
      state({ stagedGraceDeadline: null }),
    ),
  );
});
