import {
  VERIFIED_LOGIN_POLICIES,
  type VerifiedLoginPolicy,
} from "./config";

/**
 * The one database row that controls authorization-relevant login policy.
 * This is deliberately narrower than Prisma's generated model: callers must
 * parse query results before treating them as an authorization decision.
 */
export interface AuthPolicyState {
  id: 1;
  revision: number;
  policy: VerifiedLoginPolicy;
  stagedGraceDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthPolicyStateError extends Error {
  constructor() {
    super("Auth policy state is invalid");
    this.name = "AuthPolicyStateError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isVerifiedLoginPolicy(value: unknown): value is VerifiedLoginPolicy {
  return (
    typeof value === "string" &&
    VERIFIED_LOGIN_POLICIES.includes(value as VerifiedLoginPolicy)
  );
}

function hasValidPolicyDeadline(
  policy: VerifiedLoginPolicy,
  deadline: unknown,
): deadline is Date | null {
  if (policy === "staged") return isFiniteDate(deadline);
  return deadline === null;
}

/**
 * Parses a raw PostgreSQL/Prisma singleton row. Every structural or semantic
 * anomaly is rejected before it can affect an authorization decision.
 */
export function parseAuthPolicyState(value: unknown): AuthPolicyState {
  if (!isRecord(value)) throw new AuthPolicyStateError();

  const {
    id,
    revision,
    policy,
    stagedGraceDeadline,
    createdAt,
    updatedAt,
  } = value;

  if (
    id !== 1 ||
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    !isVerifiedLoginPolicy(policy) ||
    !hasValidPolicyDeadline(policy, stagedGraceDeadline) ||
    !isFiniteDate(createdAt) ||
    !isFiniteDate(updatedAt)
  ) {
    throw new AuthPolicyStateError();
  }

  return {
    id: 1,
    revision,
    policy,
    stagedGraceDeadline,
    createdAt,
    updatedAt,
  };
}
