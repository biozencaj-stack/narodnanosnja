import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeEmailAddress } from "./email-address";

export const PRIVILEGED_ACCOUNT_ROLES = ["ADMIN", "OPERATOR"] as const;

export type PrivilegedAccountRole =
  (typeof PRIVILEGED_ACCOUNT_ROLES)[number];

export type PrivilegedAccountResult =
  | Readonly<{ kind: "created" }>
  | Readonly<{ kind: "updated" }>
  | Readonly<{ kind: "exists" }>;

export type PrivilegedAccountErrorCode =
  | "INVALID_INPUT"
  | "INVALID_DATABASE_CLOCK"
  | "PERSISTENCE_FAILURE";

/**
 * Deliberately contains only a coarse code and message. Callers can safely
 * report either value without exposing an email, user id, password/hash or a
 * raw database exception.
 */
export class PrivilegedAccountError extends Error {
  readonly code: PrivilegedAccountErrorCode;

  constructor(code: PrivilegedAccountErrorCode) {
    super("Privileged account operation failed");
    this.name = "PrivilegedAccountError";
    this.code = code;
  }
}

export interface PrivilegedAccountInput {
  email: unknown;
  passwordHash: unknown;
  role: unknown;
  updateExisting?: unknown;
}

export interface PrivilegedAccountSecurityWrite {
  passwordHash: string;
  role: PrivilegedAccountRole;
  emailVerified: Date;
  emailVerificationLoginGraceUntil: null;
  verificationEmailNextAllowedAt: null;
  verificationEmailResendWindowStartedAt: null;
  verificationEmailResendCount: null;
}

export interface PrivilegedAccountCreateWrite
  extends PrivilegedAccountSecurityWrite {
  email: string;
  firstName: string;
  lastName: string;
  /**
   * Isti trenutak kao `emailVerified`, i to namerno.
   *
   * Bez njega `createdAt` dobija podrazumevanu vrednost koja nastaje POSLE
   * očitavanja `clock_timestamp()`, pa ispadne da je nalog verifikovan pre nego
   * što je nastao. `evaluateVerifiedLoginPolicy` takav snimak odbija kao
   * nemoguć i prijava puca sa `POLICY_DECISION / INTERNAL_FAILURE` — dakle
   * nalog se ne može prijaviti nikada, a poruka izgleda kao kvar politike.
   *
   * Privilegovan nalog se pravi i verifikuje u istoj transakciji, pa je jedan
   * isti trenutak i tačan opis onoga što se dogodilo.
   */
  createdAt: Date;
}

export interface PrivilegedAccountTransaction {
  /** Locks an existing User row, or serializes creation for a missing row. */
  lockUserByEmail: (
    normalizedEmail: string,
  ) => Promise<Readonly<{ id: string }> | null>;
  /** Must be invoked only after lockUserByEmail has completed. */
  readDatabaseTime: () => Promise<Date>;
  createUser: (
    input: PrivilegedAccountCreateWrite,
  ) => Promise<Readonly<{ id: string }>>;
  updateUser: (
    userId: string,
    input: PrivilegedAccountSecurityWrite,
  ) => Promise<boolean>;
  /**
   * Must run after the locked security write. It advances the user-wide
   * session epoch and revokes every device in the same transaction.
   */
  bumpAuthSessionRevisionAndRevokeSessions: (
    userId: string,
  ) => Promise<boolean>;
  deleteEmailVerifications: (userId: string) => Promise<void>;
  deletePasswordResets: (userId: string) => Promise<void>;
}

export interface PrivilegedAccountDatabase {
  transaction: <T>(
    work: (transaction: PrivilegedAccountTransaction) => Promise<T>,
  ) => Promise<T>;
}

// Keep provisioning aligned with the credentials runtime and DB preflight.
const BCRYPT_12_HASH_PATTERN = /^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/;
const DEFAULT_LAST_NAME = "[COMPANY_NAME]";

function isPrivilegedAccountRole(
  value: unknown,
): value is PrivilegedAccountRole {
  return value === "ADMIN" || value === "OPERATOR";
}

function prepareInput(input: PrivilegedAccountInput): {
  normalizedEmail: string;
  passwordHash: string;
  role: PrivilegedAccountRole;
  updateExisting: boolean;
} {
  const normalizedEmail = normalizeEmailAddress(input.email);
  if (
    normalizedEmail === null ||
    typeof input.passwordHash !== "string" ||
    !BCRYPT_12_HASH_PATTERN.test(input.passwordHash) ||
    !isPrivilegedAccountRole(input.role) ||
    (input.updateExisting !== undefined &&
      typeof input.updateExisting !== "boolean")
  ) {
    throw new PrivilegedAccountError("INVALID_INPUT");
  }

  return {
    normalizedEmail,
    passwordHash: input.passwordHash,
    role: input.role,
    updateExisting: input.updateExisting === true,
  };
}

function securityWrite(
  passwordHash: string,
  role: PrivilegedAccountRole,
  emailVerified: Date,
): PrivilegedAccountSecurityWrite {
  return {
    passwordHash,
    role,
    emailVerified,
    emailVerificationLoginGraceUntil: null,
    verificationEmailNextAllowedAt: null,
    verificationEmailResendWindowStartedAt: null,
    verificationEmailResendCount: null,
  };
}

/**
 * Creates or explicitly updates a privileged account in one transaction.
 *
 * An existing account is never changed unless updateExisting is exactly true.
 * Verification credentials are removed only after the verified User write, in
 * the same transaction. The public result intentionally carries no PII.
 */
export async function provisionPrivilegedAccount(
  input: PrivilegedAccountInput,
  database: PrivilegedAccountDatabase,
): Promise<PrivilegedAccountResult> {
  const prepared = prepareInput(input);

  try {
    return await database.transaction(async (transaction) => {
      // User is the first persistence object locked/read. This establishes the
      // same lock ordering used by email verification and resend operations.
      const existingUser = await transaction.lockUserByEmail(
        prepared.normalizedEmail,
      );

      if (existingUser && !prepared.updateExisting) {
        return { kind: "exists" };
      }

      // Read PostgreSQL time only after all row/advisory lock waiting ends.
      const verifiedAt = await transaction.readDatabaseTime();
      if (
        !(verifiedAt instanceof Date) ||
        !Number.isFinite(verifiedAt.getTime())
      ) {
        throw new PrivilegedAccountError("INVALID_DATABASE_CLOCK");
      }

      const write = securityWrite(
        prepared.passwordHash,
        prepared.role,
        verifiedAt,
      );

      if (existingUser) {
        const updated = await transaction.updateUser(existingUser.id, write);
        if (!updated) {
          throw new PrivilegedAccountError("PERSISTENCE_FAILURE");
        }
        const sessionsRevoked =
          await transaction.bumpAuthSessionRevisionAndRevokeSessions(
            existingUser.id,
          );
        if (!sessionsRevoked) {
          throw new PrivilegedAccountError("PERSISTENCE_FAILURE");
        }
        await transaction.deleteEmailVerifications(existingUser.id);
        await transaction.deletePasswordResets(existingUser.id);
        return { kind: "updated" };
      }

      const createdUser = await transaction.createUser({
        email: prepared.normalizedEmail,
        firstName: prepared.role === "ADMIN" ? "Admin" : "Operator",
        lastName: DEFAULT_LAST_NAME,
        createdAt: verifiedAt,
        ...write,
      });
      if (!createdUser.id) {
        throw new PrivilegedAccountError("PERSISTENCE_FAILURE");
      }
      await transaction.deleteEmailVerifications(createdUser.id);
      await transaction.deletePasswordResets(createdUser.id);
      return { kind: "created" };
    });
  } catch (error) {
    if (error instanceof PrivilegedAccountError) throw error;
    // Never let raw persistence errors escape into CLI/reporting output.
    throw new PrivilegedAccountError("PERSISTENCE_FAILURE");
  }
}

interface LockedPrismaUser {
  id: string;
}

function prismaTransactionAdapter(
  transaction: Prisma.TransactionClient,
): PrivilegedAccountTransaction {
  async function selectUserForUpdate(
    normalizedEmail: string,
  ): Promise<Readonly<{ id: string }> | null> {
    const rows = await transaction.$queryRaw<LockedPrismaUser[]>`
      SELECT "id"
      FROM public."User"
      WHERE "email" = ${normalizedEmail}
      FOR UPDATE
    `;

    if (
      rows.length > 1 ||
      (rows.length === 1 &&
        (typeof rows[0]?.id !== "string" || rows[0].id.length === 0))
    ) {
      throw new PrivilegedAccountError("PERSISTENCE_FAILURE");
    }

    return rows[0] ?? null;
  }

  return {
    async lockUserByEmail(normalizedEmail) {
      const existingUser = await selectUserForUpdate(normalizedEmail);
      if (existingUser) return existingUser;

      // SELECT ... FOR UPDATE cannot lock an absent row. Serialize competing
      // creates by canonical email, then repeat the User lookup after waiting.
      // The email remains a bound parameter and never becomes SQL text. Keep
      // PostgreSQL's void lock result inside a materialized CTE: exposing that
      // pseudo-type directly makes Prisma fail during result deserialization.
      const advisoryRows = await transaction.$queryRaw<
        Array<{ lockAcquired: boolean }>
      >`
        WITH advisory_lock AS MATERIALIZED (
          SELECT pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              ${normalizedEmail},
              684569237451::bigint
            )
          )
        )
        SELECT TRUE AS "lockAcquired"
        FROM advisory_lock
      `;
      if (
        advisoryRows.length !== 1 ||
        advisoryRows[0]?.lockAcquired !== true
      ) {
        throw new PrivilegedAccountError("PERSISTENCE_FAILURE");
      }

      return selectUserForUpdate(normalizedEmail);
    },

    async readDatabaseTime() {
      const rows = await transaction.$queryRaw<
        Array<{ currentTimestamp: Date }>
      >`SELECT clock_timestamp()::timestamptz(3) AS "currentTimestamp"`;
      const currentTimestamp = rows[0]?.currentTimestamp;
      if (
        rows.length !== 1 ||
        !(currentTimestamp instanceof Date) ||
        !Number.isFinite(currentTimestamp.getTime())
      ) {
        throw new PrivilegedAccountError("INVALID_DATABASE_CLOCK");
      }
      return currentTimestamp;
    },

    createUser(input) {
      return transaction.user.create({
        data: input,
        select: { id: true },
      });
    },

    async updateUser(userId, input) {
      const updated = await transaction.user.updateMany({
        where: { id: userId },
        data: input,
      });
      return updated.count === 1;
    },

    async bumpAuthSessionRevisionAndRevokeSessions(userId) {
      const rows = await transaction.$queryRaw<
        Array<{ securityEpochAdvanced: boolean }>
      >`
        WITH bumped_user AS MATERIALIZED (
          UPDATE public."User"
          SET "authSessionRevision" = "authSessionRevision" + 1
          WHERE "id" = ${userId}
            AND "authSessionRevision" < 2147483647
          RETURNING "id"
        ), revoked_sessions AS MATERIALIZED (
          DELETE FROM public."Session" AS session
          USING bumped_user
          WHERE session."userId" = bumped_user."id"
          RETURNING session."id"
        )
        SELECT EXISTS (SELECT 1 FROM bumped_user) AS "securityEpochAdvanced"
      `;
      return (
        rows.length === 1 &&
        rows[0]?.securityEpochAdvanced === true
      );
    },

    async deleteEmailVerifications(userId) {
      await transaction.emailVerification.deleteMany({ where: { userId } });
    },

    async deletePasswordResets(userId) {
      await transaction.passwordReset.deleteMany({ where: { userId } });
    },
  };
}

/** Prisma/PostgreSQL adapter used by the administrative CLI. */
export function createPrismaPrivilegedAccountDatabase(
  database: Pick<PrismaClient, "$transaction">,
): PrivilegedAccountDatabase {
  return {
    transaction: (work) =>
      database.$transaction((transaction) =>
        work(prismaTransactionAdapter(transaction)),
      ),
  };
}
