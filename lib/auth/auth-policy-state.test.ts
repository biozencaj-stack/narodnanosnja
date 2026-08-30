import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthPolicyStateError,
  parseAuthPolicyState,
  type AuthPolicyState,
} from "./auth-policy-state";

const CREATED_AT = new Date("2026-08-30T12:00:00.000Z");
const UPDATED_AT = new Date("2026-08-30T12:01:00.000Z");
const STAGED_DEADLINE = new Date("2026-09-01T12:00:00.000Z");

function rawState(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 1,
    revision: 1,
    policy: "audit",
    stagedGraceDeadline: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function parsedState(
  overrides: Record<string, unknown> = {},
): AuthPolicyState {
  return parseAuthPolicyState(rawState(overrides));
}

test("parses the exact singleton for each valid policy shape", () => {
  assert.deepEqual(parsedState(), {
    id: 1,
    revision: 1,
    policy: "audit",
    stagedGraceDeadline: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  });

  assert.equal(parsedState({ policy: "strict" }).policy, "strict");
  assert.deepEqual(
    parsedState({
      policy: "staged",
      stagedGraceDeadline: STAGED_DEADLINE,
    }),
    {
      id: 1,
      revision: 1,
      policy: "staged",
      stagedGraceDeadline: STAGED_DEADLINE,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    },
  );
});

test("rejects every non-singleton or unsafe revision", () => {
  for (const id of [0, 2, "1", null, undefined]) {
    assert.throws(
      () => parseAuthPolicyState(rawState({ id })),
      AuthPolicyStateError,
    );
  }

  for (const revision of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    "1",
    null,
  ]) {
    assert.throws(
      () => parseAuthPolicyState(rawState({ revision })),
      AuthPolicyStateError,
    );
  }
});

test("rejects any policy outside the three canonical values", () => {
  for (const policy of [
    "",
    "AUDIT",
    " audit",
    "strict ",
    "disabled",
    null,
    undefined,
  ]) {
    assert.throws(
      () => parseAuthPolicyState(rawState({ policy })),
      AuthPolicyStateError,
    );
  }
});

test("enforces staged iff one finite deadline and audit/strict null", () => {
  for (const stagedGraceDeadline of [
    null,
    undefined,
    "2026-09-01T12:00:00.000Z",
    new Date(Number.NaN),
  ]) {
    assert.throws(
      () =>
        parseAuthPolicyState(
          rawState({ policy: "staged", stagedGraceDeadline }),
        ),
      AuthPolicyStateError,
    );
  }

  for (const policy of ["audit", "strict"]) {
    for (const stagedGraceDeadline of [
      STAGED_DEADLINE,
      new Date(Number.NaN),
      undefined,
    ]) {
      assert.throws(
        () => parseAuthPolicyState(rawState({ policy, stagedGraceDeadline })),
        AuthPolicyStateError,
      );
    }
  }
});

test("rejects missing, non-Date, and non-finite singleton timestamps", () => {
  for (const field of ["createdAt", "updatedAt"] as const) {
    for (const value of [
      null,
      undefined,
      "2026-08-30T12:00:00.000Z",
      new Date(Number.NaN),
    ]) {
      assert.throws(
        () => parseAuthPolicyState(rawState({ [field]: value })),
        AuthPolicyStateError,
      );
    }
  }
});
