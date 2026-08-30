import type { VerifiedLoginPolicy } from "./config";
import { normalizeEmailAddress } from "./email-address";
import { verifyPasswordConstantWork } from "./password";
import {
  evaluateVerifiedLoginPolicy,
  type VerifiedLoginDecision,
  type VerifiedLoginRole,
} from "./verified-login-policy";

export interface CredentialsLoginInput {
  email?: unknown;
  password?: unknown;
}

/** The first lookup deliberately returns credential material only. */
export interface CredentialsLoginLookupRecord {
  id: string;
  passwordHash: string;
}

/**
 * Must be loaded after the successful bcrypt comparison. `evaluatedAt` must
 * be PostgreSQL `clock_timestamp()` from the same fresh read as the policy
 * fields, not the application process clock.
 */
export interface CredentialsLoginPolicySnapshot {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: VerifiedLoginRole;
  createdAt: Date;
  emailVerified: Date | null;
  emailVerificationLoginGraceUntil: Date | null;
  evaluatedAt: Date;
}

export interface CredentialsLoginAuthorizedUser {
  id: string;
  email: string;
  name: string;
  role: VerifiedLoginRole;
  firstName: string;
  lastName: string;
  requiresEmailVerification: boolean;
}

export type CredentialsLoginReportStage =
  | "CREDENTIAL_LOOKUP"
  | "PASSWORD_COMPARE"
  | "POLICY_SNAPSHOT"
  | "POLICY_DECISION";

export type CredentialsLoginReportReason =
  | "INTERNAL_FAILURE"
  | "AUDIT_WOULD_DENY";

/** Intentionally cannot carry an email, user id, password, hash or exception. */
export interface CredentialsLoginReport {
  stage: CredentialsLoginReportStage;
  reason: CredentialsLoginReportReason;
}

type BcryptCompare = (
  password: string,
  passwordHash: string,
) => Promise<boolean>;

export interface CredentialsLoginDependencies {
  policy: VerifiedLoginPolicy;
  stagedGraceDeadline: Date | null;
  findCredentialByEmail: (
    normalizedEmail: string,
  ) => Promise<CredentialsLoginLookupRecord | null>;
  readPolicySnapshot: (
    userId: string,
  ) => Promise<CredentialsLoginPolicySnapshot | null>;
  comparePassword?: BcryptCompare;
  report?: (event: CredentialsLoginReport) => void;
}

function safelyReport(
  reporter: CredentialsLoginDependencies["report"],
  event: CredentialsLoginReport,
): void {
  try {
    reporter?.(event);
  } catch {
    // Observability must never change authentication behavior.
  }
}

function readInput(input: unknown): CredentialsLoginInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  return input as CredentialsLoginInput;
}

/**
 * Privacy-preserving credentials authentication core.
 *
 * Every attempt with a syntactically valid canonicalizable email performs one
 * and only one bcrypt comparison. Account/policy state is refreshed only after
 * that comparison succeeds, and every expected denial has the same `null`
 * result expected by NextAuth's generic `CredentialsSignin` path.
 */
export async function authorizeCredentialsLogin(
  input: unknown,
  dependencies: CredentialsLoginDependencies,
): Promise<CredentialsLoginAuthorizedUser | null> {
  const submitted = readInput(input);
  const normalizedEmail = normalizeEmailAddress(submitted.email);
  if (!normalizedEmail) return null;

  let credential: CredentialsLoginLookupRecord | null = null;
  let lookupFailed = false;
  try {
    credential = await dependencies.findCredentialByEmail(normalizedEmail);
  } catch {
    lookupFailed = true;
  }

  let passwordMatches = false;
  try {
    passwordMatches = await verifyPasswordConstantWork(
      submitted.password,
      lookupFailed ? null : credential?.passwordHash,
      dependencies.comparePassword,
    );
  } catch {
    safelyReport(dependencies.report, {
      stage: "PASSWORD_COMPARE",
      reason: "INTERNAL_FAILURE",
    });
    return null;
  }

  if (lookupFailed) {
    safelyReport(dependencies.report, {
      stage: "CREDENTIAL_LOOKUP",
      reason: "INTERNAL_FAILURE",
    });
    return null;
  }

  if (
    !credential ||
    !passwordMatches ||
    typeof credential.id !== "string" ||
    credential.id.length === 0
  ) {
    return null;
  }

  let snapshot: CredentialsLoginPolicySnapshot | null;
  try {
    snapshot = await dependencies.readPolicySnapshot(credential.id);
  } catch {
    safelyReport(dependencies.report, {
      stage: "POLICY_SNAPSHOT",
      reason: "INTERNAL_FAILURE",
    });
    return null;
  }

  // A password/email mutation or deletion between the two reads invalidates
  // the completed comparison. Never issue a session from a stale credential.
  if (
    !snapshot ||
    snapshot.id !== credential.id ||
    snapshot.passwordHash !== credential.passwordHash ||
    snapshot.email !== normalizedEmail
  ) {
    return null;
  }

  let decision: VerifiedLoginDecision;
  try {
    decision = evaluateVerifiedLoginPolicy({
      policy: dependencies.policy,
      role: snapshot.role,
      createdAt: snapshot.createdAt,
      emailVerified: snapshot.emailVerified,
      emailVerificationLoginGraceUntil:
        snapshot.emailVerificationLoginGraceUntil,
      stagedGraceDeadline: dependencies.stagedGraceDeadline,
      evaluatedAt: snapshot.evaluatedAt,
    });
  } catch {
    safelyReport(dependencies.report, {
      stage: "POLICY_DECISION",
      reason: "INTERNAL_FAILURE",
    });
    return null;
  }

  if (decision.reason === "AUDIT_WOULD_DENY") {
    safelyReport(dependencies.report, {
      stage: "POLICY_DECISION",
      reason: "AUDIT_WOULD_DENY",
    });
  }

  if (!decision.allowed) return null;

  return {
    id: snapshot.id,
    email: snapshot.email,
    name: `${snapshot.firstName} ${snapshot.lastName}`,
    role: snapshot.role,
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    requiresEmailVerification: decision.requiresEmailVerification,
  };
}
