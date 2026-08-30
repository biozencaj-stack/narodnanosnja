import type { Prisma, PrismaClient } from "@prisma/client";
import {
  hashPassword,
  isBcryptSafePassword,
  isSupportedBcryptPasswordHash,
  verifyPasswordConstantWork,
} from "./password";

export type PasswordChangeFailureStage =
  | "INPUT"
  | "LOOKUP"
  | "VERIFY"
  | "HASH"
  | "COMMIT";

/** Coarse operational error that never carries user or credential data. */
export class PasswordChangeError extends Error {
  readonly stage: PasswordChangeFailureStage;

  constructor(stage: PasswordChangeFailureStage) {
    super("Password change operation failed");
    this.name = "PasswordChangeError";
    this.stage = stage;
  }
}

export interface PasswordChangeCredential {
  id: string;
  passwordHash: string;
}

export interface PasswordChangeTransaction {
  /** The first persistence lock in this transaction. */
  lockUserById: (
    userId: string,
  ) => Promise<PasswordChangeCredential | null>;
  updatePasswordHash: (input: {
    userId: string;
    expectedPasswordHash: string;
    newPasswordHash: string;
  }) => Promise<boolean>;
  /** Deletes every active session after the locked password/revision write. */
  deleteSessions: (userId: string) => Promise<void>;
  deletePasswordResets: (userId: string) => Promise<void>;
  deleteEmailVerifications: (userId: string) => Promise<void>;
}

export interface PasswordChangeDatabase {
  findCredentialById: (
    userId: string,
  ) => Promise<PasswordChangeCredential | null>;
  transaction: <T>(
    work: (transaction: PasswordChangeTransaction) => Promise<T>,
  ) => Promise<T>;
}

export interface PasswordChangeCrypto {
  compareCurrentPassword: (
    password: string,
    passwordHash: string,
  ) => Promise<boolean>;
  hashNewPassword: (password: string) => Promise<string>;
}

export interface PasswordChangeInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export type PasswordChangeResult =
  | Readonly<{ kind: "changed" }>
  | Readonly<{ kind: "invalid-current-password" }>;

const defaultCrypto: PasswordChangeCrypto = {
  compareCurrentPassword: verifyPasswordConstantWork,
  hashNewPassword: hashPassword,
};

/**
 * Commits a prepared password hash with User-first lock ordering.
 *
 * Returning false is an expected stale-read outcome: the account disappeared
 * or its password changed after bcrypt comparison. No credential cleanup is
 * attempted in that case.
 */
export async function commitPasswordChange(
  database: PasswordChangeDatabase,
  input: {
    userId: string;
    expectedPasswordHash: string;
    newPasswordHash: string;
  },
): Promise<boolean> {
  if (
    typeof input.userId !== "string" ||
    input.userId.length === 0 ||
    !isSupportedBcryptPasswordHash(input.expectedPasswordHash) ||
    !isSupportedBcryptPasswordHash(input.newPasswordHash)
  ) {
    throw new PasswordChangeError("INPUT");
  }

  return database.transaction(async (transaction) => {
    const lockedUser = await transaction.lockUserById(input.userId);
    if (
      !lockedUser ||
      lockedUser.id !== input.userId ||
      lockedUser.passwordHash !== input.expectedPasswordHash
    ) {
      return false;
    }

    const updated = await transaction.updatePasswordHash(input);
    if (!updated) {
      throw new PasswordChangeError("COMMIT");
    }

    // The conditional password write also advances the user session epoch.
    // The User lock remains held while every active session is deleted, so
    // this is one atomic logout-all transition rather than best-effort cleanup.
    await transaction.deleteSessions(input.userId);

    // User is already locked. Downstream credential cleanup is atomic with
    // the password write and follows the same serialization point as reset
    // confirmation and privileged-account provisioning.
    await transaction.deletePasswordResets(input.userId);
    await transaction.deleteEmailVerifications(input.userId);
    return true;
  });
}

/**
 * Authenticated password-change service. Bcrypt work is intentionally outside
 * the database transaction; the exact pre-read hash is rechecked under lock.
 */
export async function changeAuthenticatedPassword(
  input: PasswordChangeInput,
  database: PasswordChangeDatabase,
  crypto: PasswordChangeCrypto = defaultCrypto,
): Promise<PasswordChangeResult> {
  if (
    typeof input.userId !== "string" ||
    input.userId.length === 0 ||
    typeof input.currentPassword !== "string" ||
    input.currentPassword.length === 0 ||
    typeof input.newPassword !== "string" ||
    input.newPassword.length === 0 ||
    !isBcryptSafePassword(input.newPassword)
  ) {
    throw new PasswordChangeError("INPUT");
  }

  let credential: PasswordChangeCredential | null;
  try {
    credential = await database.findCredentialById(input.userId);
  } catch {
    throw new PasswordChangeError("LOOKUP");
  }
  if (
    !credential ||
    credential.id !== input.userId ||
    typeof credential.passwordHash !== "string"
  ) {
    return { kind: "invalid-current-password" };
  }

  let currentPasswordMatches: boolean;
  try {
    currentPasswordMatches = await crypto.compareCurrentPassword(
      input.currentPassword,
      credential.passwordHash,
    );
  } catch {
    throw new PasswordChangeError("VERIFY");
  }
  if (!currentPasswordMatches) {
    return { kind: "invalid-current-password" };
  }

  let newPasswordHash: string;
  try {
    newPasswordHash = await crypto.hashNewPassword(input.newPassword);
  } catch {
    throw new PasswordChangeError("HASH");
  }
  if (!isSupportedBcryptPasswordHash(newPasswordHash)) {
    throw new PasswordChangeError("HASH");
  }

  let committed: boolean;
  try {
    committed = await commitPasswordChange(database, {
      userId: credential.id,
      expectedPasswordHash: credential.passwordHash,
      newPasswordHash,
    });
  } catch {
    throw new PasswordChangeError("COMMIT");
  }

  return committed
    ? { kind: "changed" }
    : { kind: "invalid-current-password" };
}

interface LockedPasswordChangeUserRow {
  id: unknown;
  passwordHash: unknown;
}

function prismaPasswordChangeTransactionAdapter(
  transaction: Prisma.TransactionClient,
): PasswordChangeTransaction {
  return {
    async lockUserById(userId) {
      const rows = await transaction.$queryRaw<
        LockedPasswordChangeUserRow[]
      >`
        SELECT account."id", account."passwordHash"
        FROM public."User" AS account
        WHERE account."id" = ${userId}
        FOR UPDATE
      `;
      if (rows.length === 0) return null;
      const row = rows[0];
      if (
        rows.length !== 1 ||
        !row ||
        typeof row.id !== "string" ||
        typeof row.passwordHash !== "string"
      ) {
        throw new PasswordChangeError("COMMIT");
      }
      return { id: row.id, passwordHash: row.passwordHash };
    },

    async updatePasswordHash(input) {
      const updated = await transaction.user.updateMany({
        where: {
          id: input.userId,
          passwordHash: input.expectedPasswordHash,
        },
        data: {
          passwordHash: input.newPasswordHash,
          authSessionRevision: { increment: 1 },
        },
      });
      return updated.count === 1;
    },

    async deleteSessions(userId) {
      await transaction.session.deleteMany({ where: { userId } });
    },

    async deletePasswordResets(userId) {
      await transaction.passwordReset.deleteMany({ where: { userId } });
    },

    async deleteEmailVerifications(userId) {
      await transaction.emailVerification.deleteMany({ where: { userId } });
    },
  };
}

/** Prisma/PostgreSQL adapter used by the authenticated password route. */
export function createPrismaPasswordChangeDatabase(
  database: Pick<PrismaClient, "user" | "$transaction">,
): PasswordChangeDatabase {
  return {
    findCredentialById(userId) {
      return database.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true },
      });
    },

    transaction: (work) =>
      database.$transaction((transaction) =>
        work(prismaPasswordChangeTransactionAdapter(transaction)),
      ),
  };
}
