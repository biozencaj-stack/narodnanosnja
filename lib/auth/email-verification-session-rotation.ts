import type { PrismaClient } from "@prisma/client";
import { AUTH_SESSION_MAX_AGE_SECONDS } from "./config";
import { parseAuthPolicyState } from "./auth-policy-state";
import {
  createAuthoritativeSessionDatabase,
} from "./authoritative-session-database";
import {
  EmailVerificationConflictError,
  EmailVerificationExpiredError,
  type EmailVerificationClaim,
  type EmailVerificationExpectedUser,
  type EmailVerificationStoredCredential,
} from "./email-verification";
import {
  assertAuthSessionStorageSecret,
  createAuthSessionClaimsV2,
  generateAuthSessionSid,
  normalizeAuthSessionSid,
  type AuthSessionClaimsV2,
} from "./session-claims";
import { evaluateVerifiedLoginPolicy, type VerifiedLoginRole } from "./verified-login-policy";

const POSTGRES_MAX_INTEGER = 2_147_483_647;

/**
 * A deliberately coarse failure for a malformed policy/clock, exhausted
 * revision, or an internal persistence/response-preparation failure. It is
 * safe for a route to translate this into its normal retry response.
 */
export class EmailVerificationSessionRotationUnavailableError extends Error {
  constructor() {
    super("Email verification session rotation is unavailable");
    this.name = "EmailVerificationSessionRotationUnavailableError";
  }
}

export interface VerifiedSessionRotationUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: VerifiedLoginRole;
}

export interface PrepareVerifiedSessionResultInput {
  /** The raw SID is intentionally confined to these JWT claims. */
  claims: Readonly<AuthSessionClaimsV2>;
  user: Readonly<VerifiedSessionRotationUser>;
}

export interface EmailVerificationSessionRotationOptions<TResult> {
  /** The same server-only secret used by the authoritative Session store. */
  secret: string;
  /**
   * Allows a caller/test to inject a canonical SID. If absent, a CSPRNG SID is
   * generated before opening the transaction, never persisted in raw form.
   */
  sid?: unknown;
  /**
   * Must create the encrypted token/cookie-bearing response without external
   * side effects. It is invoked inside the transaction before every write.
   */
  prepareSuccessResult: (
    input: PrepareVerifiedSessionResultInput,
  ) => Promise<TResult> | TResult;
}

interface LockedVerificationUserRow extends EmailVerificationExpectedUser {
  id: string;
  createdAt: Date;
  emailVerified: Date | null;
  authSessionRevision: number;
}

interface LockedPolicyRow {
  policyId: number | null;
  policyRevision: number | null;
  policy: string | null;
  stagedGraceDeadline: Date | null;
  policyCreatedAt: Date | null;
  policyUpdatedAt: Date | null;
  policyCount: number | bigint | null;
}

interface LockedVerificationCredentialRow {
  id: string;
  userId: string;
  token: string | null;
  tokenHash: string | null;
  expires: Date;
}

interface DatabaseVerificationClockRow {
  verifiedAt: Date;
}

function isFiniteDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isNonNegativePostgresInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= POSTGRES_MAX_INTEGER
  );
}

function matchesExpectedUser(
  locked: LockedVerificationUserRow,
  claim: EmailVerificationClaim,
): boolean {
  return (
    locked.id === claim.userId &&
    locked.emailVerified === null &&
    locked.email === claim.expectedUser.email &&
    locked.passwordHash === claim.expectedUser.passwordHash &&
    locked.role === claim.expectedUser.role &&
    locked.firstName === claim.expectedUser.firstName &&
    locked.lastName === claim.expectedUser.lastName
  );
}

function matchesStoredCredential(
  locked: LockedVerificationCredentialRow,
  claim: EmailVerificationClaim,
): boolean {
  if (locked.id !== claim.id || locked.userId !== claim.userId) return false;
  if (claim.credential.kind === "hash") {
    return locked.tokenHash === claim.credential.tokenHash;
  }
  return locked.tokenHash === null && locked.token === claim.credential.token;
}

function isSingletonPolicyCount(value: unknown): boolean {
  return value === 1 || value === BigInt(1);
}

function secondAlignedDate(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1_000) * 1_000);
}

function storageCredential(
  credential: EmailVerificationStoredCredential,
): Record<string, string | null> {
  return credential.kind === "hash"
    ? { tokenHash: credential.tokenHash }
    : { token: credential.token, tokenHash: null };
}

function unavailable(): never {
  throw new EmailVerificationSessionRotationUnavailableError();
}

/**
 * Verifies an email and atomically replaces every existing Session with one
 * authoritative V2 session. The prepared result is returned only after the
 * transaction commits; errors never return a prepared cookie/result.
 *
 * Lock order is fixed globally: User, AuthPolicyState, EmailVerification.
 */
export async function commitEmailVerificationSessionRotation<TResult>(
  database: Pick<PrismaClient, "$transaction">,
  claim: EmailVerificationClaim,
  options: EmailVerificationSessionRotationOptions<TResult>,
): Promise<TResult> {
  // Generate/inject before transaction entry. The SID remains only in the
  // claims passed to the response preparer; storage receives an HMAC digest.
  let sid: string;
  try {
    assertAuthSessionStorageSecret(options.secret);
    sid =
      options.sid === undefined
        ? generateAuthSessionSid()
        : normalizeAuthSessionSid(options.sid) ?? "";
    if (!sid) unavailable();
  } catch (error) {
    if (error instanceof EmailVerificationSessionRotationUnavailableError) {
      throw error;
    }
    // Invalid deployment HMAC configuration and an RNG/SID preparation error
    // are both unavailable before any transaction or credential work begins.
    throw new EmailVerificationSessionRotationUnavailableError();
  }

  try {
    return await database.$transaction(async (transaction) => {
      const lockedUsers = await transaction.$queryRaw<LockedVerificationUserRow[]>`
        SELECT
          "id",
          "email",
          "passwordHash",
          "role"::text AS "role",
          "firstName",
          "lastName",
          "createdAt",
          "emailVerified",
          "authSessionRevision"
        FROM public."User"
        WHERE "id" = ${claim.userId}
        FOR UPDATE
      `;
      const lockedUser = lockedUsers[0];
      if (
        lockedUsers.length !== 1 ||
        !lockedUser ||
        !matchesExpectedUser(lockedUser, claim) ||
        !isFiniteDate(lockedUser.createdAt) ||
        !isNonNegativePostgresInteger(lockedUser.authSessionRevision)
      ) {
        throw new EmailVerificationConflictError();
      }

      // Keep count and locked singleton in one statement. A left join retains
      // the count row when the singleton is missing, making it fail closed.
      const lockedPolicies = await transaction.$queryRaw<LockedPolicyRow[]>`
        WITH "lockedPolicy" AS MATERIALIZED (
          SELECT
            "id" AS "policyId",
            "revision" AS "policyRevision",
            "policy",
            "stagedGraceDeadline",
            "createdAt" AS "policyCreatedAt",
            "updatedAt" AS "policyUpdatedAt"
          FROM public."AuthPolicyState"
          WHERE "id" = 1
          FOR SHARE
        ), "policyStatistics" AS MATERIALIZED (
          SELECT count(*) AS "policyCount"
          FROM public."AuthPolicyState"
        )
        SELECT
          policy."policyId",
          policy."policyRevision",
          policy."policy",
          policy."stagedGraceDeadline",
          policy."policyCreatedAt",
          policy."policyUpdatedAt",
          statistics."policyCount"
        FROM "policyStatistics" AS statistics
        LEFT JOIN "lockedPolicy" AS policy ON TRUE
      `;
      if (lockedPolicies.length !== 1 || !lockedPolicies[0]) unavailable();
      const lockedPolicy = lockedPolicies[0];

      let policyState: ReturnType<typeof parseAuthPolicyState>;
      try {
        if (!isSingletonPolicyCount(lockedPolicy.policyCount)) unavailable();
        policyState = parseAuthPolicyState({
          id: lockedPolicy.policyId,
          revision: lockedPolicy.policyRevision,
          policy: lockedPolicy.policy,
          stagedGraceDeadline: lockedPolicy.stagedGraceDeadline,
          createdAt: lockedPolicy.policyCreatedAt,
          updatedAt: lockedPolicy.policyUpdatedAt,
        });
        if (policyState.revision > POSTGRES_MAX_INTEGER) unavailable();
      } catch (error) {
        if (error instanceof EmailVerificationSessionRotationUnavailableError) {
          throw error;
        }
        unavailable();
      }

      const lockedCredentials = await transaction.$queryRaw<
        LockedVerificationCredentialRow[]
      >`
        SELECT "id", "userId", "token", "tokenHash", "expires"
        FROM public."EmailVerification"
        WHERE "id" = ${claim.id} AND "userId" = ${claim.userId}
        FOR UPDATE
      `;
      const lockedCredential = lockedCredentials[0];
      if (
        lockedCredentials.length !== 1 ||
        !lockedCredential ||
        !matchesStoredCredential(lockedCredential, claim)
      ) {
        throw new EmailVerificationConflictError();
      }

      const clockRows = await transaction.$queryRaw<DatabaseVerificationClockRow[]>`
        SELECT (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS "verifiedAt"
      `;
      const verifiedAt = clockRows[0]?.verifiedAt;
      if (clockRows.length !== 1 || !isFiniteDate(verifiedAt)) unavailable();
      if (!isFiniteDate(lockedCredential.expires)) {
        throw new EmailVerificationConflictError();
      }
      if (lockedCredential.expires.getTime() <= verifiedAt.getTime()) {
        throw new EmailVerificationExpiredError();
      }
      if (lockedUser.authSessionRevision >= POSTGRES_MAX_INTEGER) unavailable();

      try {
        const decision = evaluateVerifiedLoginPolicy({
          policy: policyState.policy,
          role: lockedUser.role,
          createdAt: lockedUser.createdAt,
          emailVerified: verifiedAt,
          emailVerificationLoginGraceUntil: null,
          stagedGraceDeadline: policyState.stagedGraceDeadline,
          evaluatedAt: verifiedAt,
        });
        if (!decision.allowed) unavailable();
      } catch (error) {
        if (error instanceof EmailVerificationSessionRotationUnavailableError) {
          throw error;
        }
        unavailable();
      }

      const issuedAt = secondAlignedDate(verifiedAt);
      const expires = new Date(
        issuedAt.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1_000,
      );
      const nextRevision = lockedUser.authSessionRevision + 1;

      let claims: Readonly<AuthSessionClaimsV2>;
      try {
        claims = createAuthSessionClaimsV2({
          sub: lockedUser.id,
          sid,
          ur: nextRevision,
          pr: policyState.revision,
          issuedAt,
          absoluteExpiresAt: expires,
        });
      } catch {
        unavailable();
      }

      // Encoding/JWE and full response construction must finish before the
      // first write. A callback failure aborts this transaction unchanged.
      const preparedResult = await options.prepareSuccessResult({
        claims,
        user: {
          id: lockedUser.id,
          email: lockedUser.email,
          firstName: lockedUser.firstName,
          lastName: lockedUser.lastName,
          role: lockedUser.role as VerifiedLoginRole,
        },
      });

      const verifiedUser = await transaction.user.updateMany({
        where: {
          id: claim.userId,
          emailVerified: null,
          authSessionRevision: lockedUser.authSessionRevision,
          email: claim.expectedUser.email,
          passwordHash: claim.expectedUser.passwordHash,
          role: claim.expectedUser.role,
          firstName: claim.expectedUser.firstName,
          lastName: claim.expectedUser.lastName,
        },
        data: {
          emailVerified: verifiedAt,
          authSessionRevision: { increment: 1 },
          emailVerificationLoginGraceUntil: null,
          verificationEmailNextAllowedAt: null,
          verificationEmailResendWindowStartedAt: null,
          verificationEmailResendCount: null,
        },
      });
      if (verifiedUser.count !== 1) throw new EmailVerificationConflictError();

      const sessions = createAuthoritativeSessionDatabase(
        transaction,
        options.secret,
      );
      await sessions.revokeAllForUser(transaction, lockedUser.id);
      await sessions.insertLockedSession(transaction, {
        sid: claims.sid,
        userId: lockedUser.id,
        authSessionRevision: nextRevision,
        authPolicyRevision: policyState.revision,
        issuedAt,
        expires,
      });

      const consumed = await transaction.emailVerification.deleteMany({
        where: {
          id: claim.id,
          userId: claim.userId,
          ...storageCredential(claim.credential),
        },
      });
      if (consumed.count !== 1) throw new EmailVerificationConflictError();
      await transaction.emailVerification.deleteMany({
        where: { userId: claim.userId },
      });

      return preparedResult;
    });
  } catch (error) {
    if (
      error instanceof EmailVerificationConflictError ||
      error instanceof EmailVerificationExpiredError ||
      error instanceof EmailVerificationSessionRotationUnavailableError
    ) {
      throw error;
    }
    // Do not surface adapter/Prisma/JWE exceptions (or raw IDs/SIDs) to the
    // eventual public route. The interactive transaction has already rolled
    // back before this boundary observes the failure.
    throw new EmailVerificationSessionRotationUnavailableError();
  }
}
