import type { Prisma, PrismaClient } from "@prisma/client";
import {
  createAuthoritativeSessionDatabase,
  type AuthoritativeSessionPrincipal,
  type InsertLockedAuthoritativeSessionInput,
} from "./authoritative-session-database";
import { parseAuthPolicyState } from "./auth-policy-state";
import { AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS } from "./session-claims-edge";
import {
  createAuthSessionClaimsV2,
  generateAuthSessionSid,
  normalizeAuthSessionSid,
  type AuthSessionClaimsV2,
} from "./session-claims";
import { normalizeEmailAddress } from "./email-address";
import { isSupportedBcryptPasswordHash } from "./password";
import {
  evaluateVerifiedLoginPolicy,
  type VerifiedLoginRole,
} from "./verified-login-policy";

const MAX_POSTGRES_INTEGER = 2_147_483_647;

/**
 * The credential material which just completed one real bcrypt comparison.
 * It is intentionally an input to the issuer rather than a JWT/User field:
 * the password hash must never enter NextAuth's callback token transport.
 */
export interface CredentialsSessionIssuanceCandidate {
  id: string;
  email: string;
  comparedPasswordHash: string;
}

export interface CredentialsSessionIssuance {
  principal: AuthoritativeSessionPrincipal;
  claims: Readonly<AuthSessionClaimsV2>;
}

interface LockedUserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: Date;
  emailVerified: Date | null;
  emailVerificationLoginGraceUntil: Date | null;
  authSessionRevision: number;
}

interface LockedPolicyRow {
  id: number;
  revision: number;
  policy: string;
  stagedGraceDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PolicyCountRow {
  policyCount: number | bigint;
}

interface DatabaseClockRow {
  evaluatedAt: Date;
  issuedAt: Date;
}

interface TimeZoneInitializationRow {
  configuredTimeZone: string;
  currentTimeZone: string;
}

export interface CredentialsSessionIssuanceTransaction {
  $queryRaw<T>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

export interface CredentialsSessionIssuanceDatabase {
  transaction: <T>(
    work: (transaction: CredentialsSessionIssuanceTransaction) => Promise<T>,
  ) => Promise<T>;
}

export interface CredentialsSessionIssuerDependencies {
  database: CredentialsSessionIssuanceDatabase;
  insertLockedSession: (
    transaction: CredentialsSessionIssuanceTransaction,
    input: InsertLockedAuthoritativeSessionInput,
  ) => Promise<void>;
  generateSid?: () => string;
}

function isFiniteDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_POSTGRES_INTEGER
  );
}

function isExactlyOne(value: number | bigint | undefined): boolean {
  return value === 1 || value === BigInt(1);
}

function isCandidate(value: unknown): value is CredentialsSessionIssuanceCandidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<CredentialsSessionIssuanceCandidate>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.email === "string" &&
    normalizeEmailAddress(candidate.email) === candidate.email &&
    isSupportedBcryptPasswordHash(candidate.comparedPasswordHash)
  );
}

function isLockedUserRow(value: unknown): value is LockedUserRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const user = value as Partial<LockedUserRow>;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.passwordHash === "string" &&
    typeof user.firstName === "string" &&
    typeof user.lastName === "string" &&
    typeof user.role === "string" &&
    isFiniteDate(user.createdAt) &&
    (user.emailVerified === null || isFiniteDate(user.emailVerified)) &&
    (user.emailVerificationLoginGraceUntil === null ||
      isFiniteDate(user.emailVerificationLoginGraceUntil)) &&
    isSafeNonNegativeInteger(user.authSessionRevision)
  );
}

function asPrincipal(
  user: LockedUserRow,
  role: VerifiedLoginRole,
  requiresEmailVerification: boolean,
): AuthoritativeSessionPrincipal {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role,
    requiresEmailVerification,
  };
}

/**
 * Creates a dormant, DB-authoritative V2 issuance primitive.
 *
 * It deliberately has no NextAuth dependency and is not wired into the
 * active Credentials provider yet. A caller supplies the password hash that
 * has just passed bcrypt; the locked database row must still exactly match it
 * before a session can be inserted.
 */
export function createCredentialsSessionIssuer(
  dependencies: CredentialsSessionIssuerDependencies,
) {
  return {
    async issue(
      candidate: unknown,
      injectedSid?: unknown,
    ): Promise<CredentialsSessionIssuance | null> {
      if (!isCandidate(candidate)) return null;

      let sid: string;
      try {
        sid =
          injectedSid === undefined
            ? (dependencies.generateSid ?? generateAuthSessionSid)()
            : (injectedSid as string);
      } catch {
        return null;
      }
      if (normalizeAuthSessionSid(sid) !== sid) return null;

      try {
        return await dependencies.database.transaction(async (transaction) => {
          const timeZoneRows = await transaction.$queryRaw<
            TimeZoneInitializationRow[]
          >`
            WITH "timeZoneInitialization" AS MATERIALIZED (
              SELECT pg_catalog.set_config('TimeZone', 'UTC', true)
                AS "configuredTimeZone"
            )
            SELECT
              "configuredTimeZone",
              pg_catalog.current_setting('TimeZone') AS "currentTimeZone"
            FROM "timeZoneInitialization"
          `;
          const timeZone = timeZoneRows[0];
          if (
            timeZoneRows.length !== 1 ||
            !timeZone ||
            timeZone.configuredTimeZone !== "UTC" ||
            timeZone.currentTimeZone !== "UTC"
          ) {
            throw new Error("Credentials issuance UTC initialization invalid");
          }

          const lockedUsers = await transaction.$queryRaw<LockedUserRow[]>`
            SELECT
              "id",
              "email",
              "passwordHash",
              "firstName",
              "lastName",
              "role"::text AS "role",
              "createdAt",
              "emailVerified",
              "emailVerificationLoginGraceUntil",
              "authSessionRevision"
            FROM public."User"
            WHERE "id" = ${candidate.id}
            FOR UPDATE
          `;
          const user = lockedUsers[0];
          if (
            lockedUsers.length !== 1 ||
            !user ||
            !isLockedUserRow(user) ||
            user.id !== candidate.id ||
            user.email !== candidate.email ||
            user.passwordHash !== candidate.comparedPasswordHash
          ) {
            throw new Error("Credentials issuance snapshot mismatch");
          }

          const lockedPolicies = await transaction.$queryRaw<LockedPolicyRow[]>`
            SELECT
              "id",
              "revision",
              "policy",
              "stagedGraceDeadline",
              "createdAt",
              "updatedAt"
            FROM public."AuthPolicyState"
            WHERE "id" = 1
            FOR SHARE
          `;
          const policyRow = lockedPolicies[0];
          if (lockedPolicies.length !== 1 || !policyRow) {
            throw new Error("Credentials issuance policy lock mismatch");
          }

          const policyCounts = await transaction.$queryRaw<PolicyCountRow[]>`
            SELECT count(*) AS "policyCount"
            FROM public."AuthPolicyState"
          `;
          if (
            policyCounts.length !== 1 ||
            !isExactlyOne(policyCounts[0]?.policyCount)
          ) {
            throw new Error("Credentials issuance policy count mismatch");
          }

          const clockRows = await transaction.$queryRaw<DatabaseClockRow[]>`
            WITH "databaseClock" AS MATERIALIZED (
              SELECT (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
                AS "evaluatedAt"
            )
            SELECT
              "evaluatedAt",
              date_trunc('second', "evaluatedAt")::timestamp(3) AS "issuedAt"
            FROM "databaseClock"
          `;
          const evaluatedAt = clockRows[0]?.evaluatedAt;
          const issuedAt = clockRows[0]?.issuedAt;
          if (
            clockRows.length !== 1 ||
            !isFiniteDate(evaluatedAt) ||
            !isFiniteDate(issuedAt) ||
            issuedAt.getMilliseconds() !== 0 ||
            issuedAt.getTime() > evaluatedAt.getTime()
          ) {
            throw new Error("Credentials issuance database clock invalid");
          }

          const policyState = parseAuthPolicyState(policyRow);
          if (policyState.revision > MAX_POSTGRES_INTEGER) {
            throw new Error("Credentials issuance policy revision out of bounds");
          }
          const decision = evaluateVerifiedLoginPolicy({
            policy: policyState.policy,
            role: user.role,
            createdAt: user.createdAt,
            emailVerified: user.emailVerified,
            emailVerificationLoginGraceUntil:
              user.emailVerificationLoginGraceUntil,
            stagedGraceDeadline: policyState.stagedGraceDeadline,
            evaluatedAt,
          });
          if (!decision.allowed) {
            throw new Error("Credentials issuance policy denied");
          }

          const absoluteExpiresAt = new Date(
            issuedAt.getTime() +
              AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS * 1_000,
          );
          const claims = createAuthSessionClaimsV2({
            sub: user.id,
            sid,
            ur: user.authSessionRevision,
            pr: policyState.revision,
            issuedAt,
            absoluteExpiresAt,
          });

          await dependencies.insertLockedSession(transaction, {
            sid: claims.sid,
            userId: user.id,
            authSessionRevision: user.authSessionRevision,
            authPolicyRevision: policyState.revision,
            issuedAt,
            expires: absoluteExpiresAt,
          });

          return {
            principal: asPrincipal(
              user,
              user.role as VerifiedLoginRole,
              decision.requiresEmailVerification,
            ),
            claims,
          };
        });
      } catch {
        // Credentials failures intentionally have one coarse, fail-closed
        // outcome. Callers may log a non-sensitive stage outside this module.
        return null;
      }
    },
  };
}

/** Binds the generic issuer to Prisma and the reviewed HMAC-only insert core. */
export function createPrismaCredentialsSessionIssuer(
  prisma: PrismaClient,
  secret: string,
  overrides: Partial<
    Pick<CredentialsSessionIssuerDependencies, "generateSid" | "insertLockedSession">
  > = {},
) {
  const authoritative = createAuthoritativeSessionDatabase(prisma, secret);

  return createCredentialsSessionIssuer({
    database: {
      transaction: (work) =>
        prisma.$transaction((transaction) =>
          work(transaction as unknown as CredentialsSessionIssuanceTransaction),
        ),
    },
    generateSid: overrides.generateSid,
    insertLockedSession:
      overrides.insertLockedSession ??
      ((transaction, input) =>
        authoritative.insertLockedSession(
          transaction as unknown as Prisma.TransactionClient,
          input,
        )),
  });
}
