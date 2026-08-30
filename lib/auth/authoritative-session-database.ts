import type { Prisma, PrismaClient } from "@prisma/client";
import {
  assertAuthSessionStorageSecret,
  createAuthSessionStorageKey,
  parseAuthSessionClaimsV2,
  type AuthSessionClaimsV2,
} from "./session-claims";
import {
  parseAuthPolicyState,
} from "./auth-policy-state";
import {
  evaluateVerifiedLoginPolicy,
  type VerifiedLoginRole,
} from "./verified-login-policy";

export interface AuthoritativeSessionPrincipal {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: VerifiedLoginRole;
  requiresEmailVerification: boolean;
}

export type AuthoritativeSessionValidation =
  | { status: "valid"; principal: AuthoritativeSessionPrincipal }
  | { status: "invalid" }
  | { status: "unavailable" };

/**
 * Input for a new authoritative Session row.
 *
 * The caller MUST already be inside a transaction which holds `FOR UPDATE` on
 * the target User and a policy-row lock that conflicts with policy writes
 * (`FOR SHARE` or stronger) on the AuthPolicyState singleton. This primitive
 * deliberately does not acquire those locks: doing it here would conceal an
 * unsafe lock order from the authentication mutation that owns the wider state
 * transition.
 */
export interface InsertLockedAuthoritativeSessionInput {
  sid: string;
  userId: string;
  authSessionRevision: number;
  authPolicyRevision: number;
  issuedAt: Date;
  expires: Date;
}

interface SessionValidationRow {
  sessionUserId: string | null;
  sessionUserRevision: number | null;
  sessionPolicyRevision: number | null;
  sessionIssuedAt: Date | null;
  sessionExpires: Date | null;
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  createdAt: Date | null;
  emailVerified: Date | null;
  emailVerificationLoginGraceUntil: Date | null;
  userRevision: number | null;
  policyId: number | null;
  policyRevision: number | null;
  policy: string | null;
  stagedGraceDeadline: Date | null;
  policyCreatedAt: Date | null;
  policyUpdatedAt: Date | null;
  policyCount: number | bigint | null;
  evaluatedAt: Date | null;
}

const MAX_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function isFiniteDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

function parseClaims(input: unknown): Readonly<AuthSessionClaimsV2> | null {
  return parseAuthSessionClaimsV2(input);
}

function hasValidSessionAndUserRow(row: SessionValidationRow): boolean {
  return (
    typeof row.sessionUserId === "string" &&
    row.sessionUserId.length > 0 &&
    row.sessionUserId === row.userId &&
    isNonNegativeInteger(row.sessionUserRevision) &&
    isNonNegativeInteger(row.userRevision) &&
    isPositiveInteger(row.sessionPolicyRevision) &&
    isFiniteDate(row.sessionIssuedAt) &&
    isFiniteDate(row.sessionExpires) &&
    typeof row.email === "string" &&
    typeof row.firstName === "string" &&
    typeof row.lastName === "string" &&
    ["CUSTOMER", "OPERATOR", "ADMIN"].includes(row.role ?? "") &&
    isFiniteDate(row.createdAt) &&
    (row.emailVerified === null || isFiniteDate(row.emailVerified)) &&
    (row.emailVerificationLoginGraceUntil === null ||
      isFiniteDate(row.emailVerificationLoginGraceUntil))
  );
}

function sameTimestamp(date: Date, unixSeconds: number): boolean {
  return date.getTime() === unixSeconds * 1_000;
}

function isSessionClaimMatch(
  row: SessionValidationRow,
  claims: Readonly<AuthSessionClaimsV2>,
): boolean {
  return (
    row.sessionUserId === claims.sub &&
    row.userId === claims.sub &&
    row.sessionUserRevision === claims.ur &&
    row.userRevision === claims.ur &&
    row.sessionPolicyRevision === claims.pr &&
    row.policyRevision === claims.pr &&
    row.sessionIssuedAt !== null &&
    sameTimestamp(row.sessionIssuedAt, claims.sat) &&
    row.sessionExpires !== null &&
    sameTimestamp(row.sessionExpires, claims.sae)
  );
}

function hasSaneSessionLifetime(row: SessionValidationRow): boolean {
  if (!row.sessionIssuedAt || !row.sessionExpires) return false;
  const duration = row.sessionExpires.getTime() - row.sessionIssuedAt.getTime();
  return duration > 0 && duration <= MAX_SESSION_LIFETIME_MS;
}

/**
 * Creates the database authority for a v2 session cookie.
 *
 * There is intentionally no positive cross-request cache. A successful result
 * is proof only for the current request and is derived from one PostgreSQL
 * statement that reads Session, User, AuthPolicyState and the database clock.
 */
export function createAuthoritativeSessionDatabase(
  prisma: PrismaClient | Prisma.TransactionClient,
  secret: string,
) {
  const digestFor = (sid: string): string | null =>
    createAuthSessionStorageKey(secret, sid);

  // Validate the server-only HMAC configuration when wiring dependencies, not
  // after receiving an untrusted cookie.
  assertAuthSessionStorageSecret(secret);

  return {
    async validate(input: unknown): Promise<AuthoritativeSessionValidation> {
      const claims = parseClaims(input);
      if (!claims) return { status: "invalid" };

      let digest: string | null;
      try {
        digest = digestFor(claims.sid);
      } catch {
        return { status: "invalid" };
      }
      if (!digest) return { status: "invalid" };

      let rows: SessionValidationRow[];
      try {
        rows = await prisma.$queryRaw<SessionValidationRow[]>`
          WITH "databaseClock" AS MATERIALIZED (
            SELECT (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS "evaluatedAt"
          ),
          "sessionAndUser" AS MATERIALIZED (
            SELECT
              session."userId" AS "sessionUserId",
              session."authSessionRevision" AS "sessionUserRevision",
              session."authPolicyRevision" AS "sessionPolicyRevision",
              session."issuedAt" AS "sessionIssuedAt",
              session."expires" AS "sessionExpires",
              "user"."id" AS "userId",
              "user"."email" AS "email",
              "user"."firstName" AS "firstName",
              "user"."lastName" AS "lastName",
              "user"."role"::text AS "role",
              "user"."createdAt" AS "createdAt",
              "user"."emailVerified" AS "emailVerified",
              "user"."emailVerificationLoginGraceUntil" AS "emailVerificationLoginGraceUntil",
              "user"."authSessionRevision" AS "userRevision"
            FROM public."Session" AS session
            INNER JOIN public."User" AS "user" ON "user"."id" = session."userId"
            WHERE session."sessionToken" = ${digest}
          ),
          "policyState" AS MATERIALIZED (
            SELECT
              "id" AS "policyId",
              "revision" AS "policyRevision",
              "policy",
              "stagedGraceDeadline",
              "createdAt" AS "policyCreatedAt",
              "updatedAt" AS "policyUpdatedAt"
            FROM public."AuthPolicyState"
            WHERE "id" = 1
          ),
          "policyStatistics" AS MATERIALIZED (
            SELECT count(*) AS "policyCount"
            FROM public."AuthPolicyState"
          )
          SELECT
            session."sessionUserId",
            session."sessionUserRevision",
            session."sessionPolicyRevision",
            session."sessionIssuedAt",
            session."sessionExpires",
            session."userId",
            session."email",
            session."firstName",
            session."lastName",
            session."role",
            session."createdAt",
            session."emailVerified",
            session."emailVerificationLoginGraceUntil",
            session."userRevision",
            policy."policyId",
            policy."policyRevision",
            policy."policy",
            policy."stagedGraceDeadline",
            policy."policyCreatedAt",
            policy."policyUpdatedAt",
            statistics."policyCount",
            clock."evaluatedAt"
          FROM "databaseClock" AS clock
          LEFT JOIN "sessionAndUser" AS session ON TRUE
          LEFT JOIN "policyState" AS policy ON TRUE
          CROSS JOIN "policyStatistics" AS statistics
        `;
      } catch {
        return { status: "unavailable" };
      }

      if (rows.length !== 1 || !rows[0]) return { status: "unavailable" };
      const row = rows[0];
      if (!isFiniteDate(row.evaluatedAt)) {
        return { status: "unavailable" };
      }

      let policyState: ReturnType<typeof parseAuthPolicyState>;
      try {
        if (row.policyCount !== 1 && row.policyCount !== BigInt(1)) {
          return { status: "unavailable" };
        }
        policyState = parseAuthPolicyState({
          id: row.policyId,
          revision: row.policyRevision,
          policy: row.policy,
          stagedGraceDeadline: row.stagedGraceDeadline,
          createdAt: row.policyCreatedAt,
          updatedAt: row.policyUpdatedAt,
        });
      } catch {
        return { status: "unavailable" };
      }
      // A missing Session is represented by a null sessionUserId. A Session
      // whose user disappeared is likewise an invalid credential, not an
      // infrastructure outage; both paths must deny as a logged-out user.
      if (row.sessionUserId === null || row.userId === null) {
        return { status: "invalid" };
      }
      if (!hasValidSessionAndUserRow(row) || !hasSaneSessionLifetime(row)) {
        return { status: "unavailable" };
      }
      if (!isSessionClaimMatch(row, claims)) return { status: "invalid" };
      if (row.sessionExpires === null || row.sessionExpires <= row.evaluatedAt) {
        return { status: "invalid" };
      }

      try {
        const decision = evaluateVerifiedLoginPolicy({
          policy: policyState.policy,
          role: row.role as VerifiedLoginRole,
          createdAt: row.createdAt as Date,
          emailVerified: row.emailVerified,
          emailVerificationLoginGraceUntil:
            row.emailVerificationLoginGraceUntil,
          stagedGraceDeadline: policyState.stagedGraceDeadline,
          evaluatedAt: row.evaluatedAt,
        });
        if (!decision.allowed) return { status: "invalid" };

        return {
          status: "valid",
          principal: {
            id: row.userId as string,
            email: row.email as string,
            firstName: row.firstName as string,
            lastName: row.lastName as string,
            name: `${row.firstName} ${row.lastName}`.trim(),
            role: row.role as VerifiedLoginRole,
            requiresEmailVerification: decision.requiresEmailVerification,
          },
        };
      } catch {
        // Invalid persisted user/policy values cannot be safely interpreted as
        // a guest session: surface a dependency failure to the caller instead.
        return { status: "unavailable" };
      }
    },

    /** Deletes exactly the current v2 session; it never performs logout-all. */
    async revokeCurrent(input: unknown): Promise<"revoked" | "invalid" | "unavailable"> {
      const claims = parseClaims(input);
      if (!claims) return "invalid";

      let digest: string | null;
      try {
        digest = digestFor(claims.sid);
      } catch {
        return "invalid";
      }
      if (!digest) return "invalid";

      try {
        const deleted = await prisma.session.deleteMany({
          where: {
            sessionToken: digest,
            userId: claims.sub,
            authSessionRevision: claims.ur,
            authPolicyRevision: claims.pr,
            issuedAt: new Date(claims.sat * 1_000),
            expires: new Date(claims.sae * 1_000),
          },
        });
        return deleted.count === 1 ? "revoked" : "invalid";
      } catch {
        return "unavailable";
      }
    },

    /**
     * Inserts one v2 session row after the caller acquired User then a
     * write-conflicting policy lock in the surrounding transaction. Do not
     * call outside that lock.
     */
    async insertLockedSession(
      transaction: Prisma.TransactionClient,
      input: InsertLockedAuthoritativeSessionInput,
    ): Promise<void> {
      if (
        typeof input.sid !== "string" ||
        input.sid.length === 0 ||
        typeof input.userId !== "string" ||
        input.userId.length === 0 ||
        !isNonNegativeInteger(input.authSessionRevision) ||
        !isPositiveInteger(input.authPolicyRevision) ||
        !isFiniteDate(input.issuedAt) ||
        !isFiniteDate(input.expires) ||
        input.expires.getTime() <= input.issuedAt.getTime() ||
        input.expires.getTime() - input.issuedAt.getTime() > MAX_SESSION_LIFETIME_MS ||
        input.issuedAt.getMilliseconds() !== 0 ||
        input.expires.getMilliseconds() !== 0
      ) {
        throw new Error("Invalid locked authoritative session insert input");
      }

      await transaction.session.create({
        data: {
          sessionToken: (() => {
            const digest = digestFor(input.sid);
            if (!digest) {
              throw new Error("Invalid locked authoritative session SID");
            }
            return digest;
          })(),
          userId: input.userId,
          authSessionRevision: input.authSessionRevision,
          authPolicyRevision: input.authPolicyRevision,
          issuedAt: input.issuedAt,
          expires: input.expires,
        },
        select: { id: true },
      });
    },

    /**
     * Revokes every Session for a user inside a caller-owned security write
     * transaction. The caller MUST already hold that User's `FOR UPDATE` lock
     * before invoking this helper, so an auth revision bump and this cleanup
     * remain one ordered state transition.
     */
    async revokeAllForUser(
      transaction: Prisma.TransactionClient,
      userId: string,
    ): Promise<number> {
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("Invalid locked authoritative session user id");
      }
      const deleted = await transaction.session.deleteMany({
        where: { userId },
      });
      return deleted.count;
    },
  };
}
