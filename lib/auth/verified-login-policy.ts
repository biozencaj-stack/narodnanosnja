import {
  VERIFIED_LOGIN_MAX_GRACE_WINDOW_MS,
  type VerifiedLoginPolicy,
} from "./config";

export type VerifiedLoginRole = "CUSTOMER" | "OPERATOR" | "ADMIN";

export type VerifiedLoginDecisionReason =
  | "VERIFIED"
  | "AUDIT_WOULD_DENY"
  | "STAGED_GRACE_ACTIVE"
  | "STAGED_VERIFICATION_REQUIRED"
  | "STRICT_VERIFICATION_REQUIRED";

export interface VerifiedLoginPolicyState {
  policy: VerifiedLoginPolicy;
  role: VerifiedLoginRole | string;
  createdAt: Date;
  emailVerified: Date | null;
  emailVerificationLoginGraceUntil: Date | null;
  /** Exact reviewed rollout deadline from deployment configuration. */
  stagedGraceDeadline: Date | null;
  /** Must come from the same fresh database snapshot as the policy fields. */
  evaluatedAt: Date;
}

export interface VerifiedLoginDecision {
  allowed: boolean;
  requiresEmailVerification: boolean;
  reason: VerifiedLoginDecisionReason;
}

export class VerifiedLoginPolicyStateError extends Error {
  constructor() {
    super("Invalid verified-login policy state");
    this.name = "VerifiedLoginPolicyStateError";
  }
}

function isFiniteDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function assertValidPolicyState(state: VerifiedLoginPolicyState): void {
  if (
    !["audit", "staged", "strict"].includes(state.policy) ||
    !["CUSTOMER", "OPERATOR", "ADMIN"].includes(state.role) ||
    !isFiniteDate(state.createdAt) ||
    !isFiniteDate(state.evaluatedAt) ||
    state.createdAt.getTime() > state.evaluatedAt.getTime() ||
    (state.emailVerified !== null && !isFiniteDate(state.emailVerified)) ||
    (state.emailVerificationLoginGraceUntil !== null &&
      !isFiniteDate(state.emailVerificationLoginGraceUntil)) ||
    (state.stagedGraceDeadline !== null &&
      !isFiniteDate(state.stagedGraceDeadline))
  ) {
    throw new VerifiedLoginPolicyStateError();
  }

  if (
    state.emailVerified !== null &&
    (state.emailVerified.getTime() < state.createdAt.getTime() ||
      state.emailVerified.getTime() > state.evaluatedAt.getTime())
  ) {
    throw new VerifiedLoginPolicyStateError();
  }

  if (state.policy === "staged") {
    if (
      state.stagedGraceDeadline === null ||
      state.stagedGraceDeadline.getTime() - state.evaluatedAt.getTime() >
        VERIFIED_LOGIN_MAX_GRACE_WINDOW_MS ||
      (state.emailVerificationLoginGraceUntil !== null &&
        state.emailVerificationLoginGraceUntil.getTime() !==
          state.stagedGraceDeadline.getTime())
    ) {
      throw new VerifiedLoginPolicyStateError();
    }
  }
}

/**
 * Makes the verified-login decision from a fresh database policy snapshot.
 * Invalid timestamps are never treated as proof or as an active grace period.
 */
export function evaluateVerifiedLoginPolicy(
  state: VerifiedLoginPolicyState,
): VerifiedLoginDecision {
  assertValidPolicyState(state);

  if (state.emailVerified !== null) {
    return {
      allowed: true,
      requiresEmailVerification: false,
      reason: "VERIFIED",
    };
  }

  if (state.policy === "audit") {
    return {
      allowed: true,
      requiresEmailVerification: true,
      reason: "AUDIT_WOULD_DENY",
    };
  }

  if (state.policy === "strict") {
    return {
      allowed: false,
      requiresEmailVerification: true,
      reason: "STRICT_VERIFICATION_REQUIRED",
    };
  }

  if (
    state.policy === "staged" &&
    state.role === "CUSTOMER" &&
    state.stagedGraceDeadline !== null &&
    state.stagedGraceDeadline.getTime() > state.evaluatedAt.getTime() &&
    state.emailVerificationLoginGraceUntil !== null &&
    state.emailVerificationLoginGraceUntil.getTime() >
      state.evaluatedAt.getTime()
  ) {
    return {
      allowed: true,
      requiresEmailVerification: true,
      reason: "STAGED_GRACE_ACTIVE",
    };
  }

  return {
    allowed: false,
    requiresEmailVerification: true,
    reason: "STAGED_VERIFICATION_REQUIRED",
  };
}
