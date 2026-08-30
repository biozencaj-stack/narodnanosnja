import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeEmailAddress } from "../auth/email-address";

export const DEMO_USER_ROLES = ["CUSTOMER", "OPERATOR", "ADMIN"] as const;
export type DemoUserRole = (typeof DEMO_USER_ROLES)[number];

export interface DemoUserSyncInput {
  email: unknown;
  firstName: unknown;
  lastName: unknown;
  role: unknown;
  passwordHash: unknown;
  verifiedAt: unknown;
}

export type DemoUserSyncResult = Readonly<{
  id: string;
  kind: "created" | "updated";
}>;

export class DemoUserSyncError extends Error {
  constructor() {
    super("Demo user synchronization failed");
    this.name = "DemoUserSyncError";
  }
}

interface PreparedDemoUser {
  email: string;
  firstName: string;
  lastName: string;
  role: DemoUserRole;
  passwordHash: string;
  verifiedAt: Date;
}

export interface DemoUserTransaction {
  /** Locks the User row or serializes a missing-email create. */
  lockUserByEmail: (
    email: string,
  ) => Promise<Readonly<{ id: string; authSessionRevision: number }> | null>;
  createUser: (
    input: PreparedDemoUser & { authSessionRevision: 0 },
  ) => Promise<Readonly<{ id: string }>>;
  updateUserSecurity: (
    userId: string,
    expectedRevision: number,
    nextRevision: number,
    input: PreparedDemoUser,
  ) => Promise<boolean>;
  deleteSessions: (userId: string) => Promise<void>;
  deleteEmailVerifications: (userId: string) => Promise<void>;
  deletePasswordResets: (userId: string) => Promise<void>;
}

export interface DemoUserDatabase {
  transaction: <T>(
    work: (transaction: DemoUserTransaction) => Promise<T>,
  ) => Promise<T>;
}

const BCRYPT_12_HASH_PATTERN = /^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/;
const MAX_POSTGRES_INTEGER = 2_147_483_647;

function isDemoUserRole(value: unknown): value is DemoUserRole {
  return DEMO_USER_ROLES.includes(value as DemoUserRole);
}

function boundedName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.length <= 100 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function prepareDemoUser(input: DemoUserSyncInput): PreparedDemoUser {
  const normalizedEmail = normalizeEmailAddress(input.email);
  if (
    normalizedEmail === null ||
    input.email !== normalizedEmail ||
    !boundedName(input.firstName) ||
    !boundedName(input.lastName) ||
    !isDemoUserRole(input.role) ||
    typeof input.passwordHash !== "string" ||
    !BCRYPT_12_HASH_PATTERN.test(input.passwordHash) ||
    !(input.verifiedAt instanceof Date) ||
    !Number.isFinite(input.verifiedAt.getTime())
  ) {
    throw new DemoUserSyncError();
  }

  return {
    email: normalizedEmail,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    passwordHash: input.passwordHash,
    verifiedAt: new Date(input.verifiedAt.getTime()),
  };
}

/**
 * Synchronizes one public demo credential without leaving pre-existing login
 * sessions valid. Existing users are locked first, receive a monotonic session
 * revision bump, and lose all Session rows before credential cleanup. A new
 * user starts explicitly at revision zero and has no sessions to revoke.
 */
export async function synchronizeDemoUser(
  input: DemoUserSyncInput,
  database: DemoUserDatabase,
): Promise<DemoUserSyncResult> {
  const prepared = prepareDemoUser(input);

  try {
    return await database.transaction(async (transaction) => {
      const existing = await transaction.lockUserByEmail(prepared.email);

      let userId: string;
      let kind: "created" | "updated";
      if (existing) {
        if (
          !Number.isInteger(existing.authSessionRevision) ||
          existing.authSessionRevision < 0 ||
          existing.authSessionRevision >= MAX_POSTGRES_INTEGER
        ) {
          throw new DemoUserSyncError();
        }
        const nextRevision = existing.authSessionRevision + 1;
        const updated = await transaction.updateUserSecurity(
          existing.id,
          existing.authSessionRevision,
          nextRevision,
          prepared,
        );
        if (!updated) throw new DemoUserSyncError();

        await transaction.deleteSessions(existing.id);
        userId = existing.id;
        kind = "updated";
      } else {
        const created = await transaction.createUser({
          ...prepared,
          authSessionRevision: 0,
        });
        if (typeof created.id !== "string" || created.id.length === 0) {
          throw new DemoUserSyncError();
        }
        userId = created.id;
        kind = "created";
      }

      await transaction.deleteEmailVerifications(userId);
      await transaction.deletePasswordResets(userId);
      return { id: userId, kind };
    });
  } catch (error) {
    if (error instanceof DemoUserSyncError) throw error;
    throw new DemoUserSyncError();
  }
}

interface LockedDemoUserRow {
  id: string;
  authSessionRevision: number;
}

function prismaDemoUserTransaction(
  transaction: Prisma.TransactionClient,
): DemoUserTransaction {
  async function selectUserForUpdate(
    email: string,
  ): Promise<LockedDemoUserRow | null> {
    const rows = await transaction.$queryRaw<LockedDemoUserRow[]>`
      SELECT "id", "authSessionRevision"
      FROM public."User"
      WHERE "email" = ${email}
      FOR UPDATE
    `;
    if (
      rows.length > 1 ||
      (rows.length === 1 &&
        (typeof rows[0]?.id !== "string" ||
          rows[0].id.length === 0 ||
          !Number.isInteger(rows[0].authSessionRevision)))
    ) {
      throw new DemoUserSyncError();
    }
    return rows[0] ?? null;
  }

  return {
    async lockUserByEmail(email) {
      const existing = await selectUserForUpdate(email);
      if (existing) return existing;

      const lockRows = await transaction.$queryRaw<
        Array<{ lockAcquired: boolean }>
      >`
        WITH advisory_lock AS MATERIALIZED (
          SELECT pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              ${email},
              447139755269::bigint
            )
          )
        )
        SELECT TRUE AS "lockAcquired"
        FROM advisory_lock
      `;
      if (
        lockRows.length !== 1 ||
        lockRows[0]?.lockAcquired !== true
      ) {
        throw new DemoUserSyncError();
      }
      return selectUserForUpdate(email);
    },

    createUser(input) {
      return transaction.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          passwordHash: input.passwordHash,
          createdAt: input.verifiedAt,
          emailVerified: input.verifiedAt,
          emailVerificationLoginGraceUntil: null,
          authSessionRevision: input.authSessionRevision,
          verificationEmailNextAllowedAt: null,
          verificationEmailResendWindowStartedAt: null,
          verificationEmailResendCount: null,
          newsletterOptIn: true,
        },
        select: { id: true },
      });
    },

    async updateUserSecurity(
      userId,
      expectedRevision,
      nextRevision,
      input,
    ) {
      const updated = await transaction.user.updateMany({
        where: {
          id: userId,
          authSessionRevision: expectedRevision,
        },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          passwordHash: input.passwordHash,
          emailVerified: input.verifiedAt,
          emailVerificationLoginGraceUntil: null,
          authSessionRevision: nextRevision,
          verificationEmailNextAllowedAt: null,
          verificationEmailResendWindowStartedAt: null,
          verificationEmailResendCount: null,
        },
      });
      return updated.count === 1;
    },

    async deleteSessions(userId) {
      await transaction.session.deleteMany({ where: { userId } });
    },

    async deleteEmailVerifications(userId) {
      await transaction.emailVerification.deleteMany({ where: { userId } });
    },

    async deletePasswordResets(userId) {
      await transaction.passwordReset.deleteMany({ where: { userId } });
    },
  };
}

export function createPrismaDemoUserDatabase(
  database: Pick<PrismaClient, "$transaction">,
): DemoUserDatabase {
  return {
    transaction(work) {
      return database.$transaction(
        (transaction) => work(prismaDemoUserTransaction(transaction)),
        { timeout: 15_000 },
      );
    },
  };
}
