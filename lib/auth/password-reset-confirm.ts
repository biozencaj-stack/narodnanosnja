export class PasswordResetConfirmConflictError extends Error {
  constructor() {
    super("Password reset credential claim conflict");
    this.name = "PasswordResetConfirmConflictError";
  }
}

export type PasswordResetCredentialClaim =
  | {
      kind: "current-hash";
      storedValue: string;
    }
  | {
      kind: "legacy-plaintext";
      storedValue: string;
    };

export interface PasswordResetConfirmClaim {
  id: string;
  userId: string;
  credential: PasswordResetCredentialClaim;
}

type PasswordResetClaimWhere =
  | {
      id: string;
      userId: string;
      tokenHash: string;
    }
  | {
      id: string;
      userId: string;
      token: string;
      tokenHash: null;
    };

interface PasswordResetConfirmTransaction {
  $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  emailVerification: {
    deleteMany(input: {
      where: { userId: string };
    }): Promise<{ count: number }>;
  };
  passwordReset: {
    deleteMany(input: {
      where: PasswordResetClaimWhere | { userId: string };
    }): Promise<{ count: number }>;
  };
  user: {
    updateMany(input: {
      where: { id: string };
      data: {
        passwordHash: string;
        authSessionRevision: { increment: 1 };
      };
    }): Promise<{ count: number }>;
  };
  session: {
    deleteMany(input: {
      where: { userId: string };
    }): Promise<{ count: number }>;
  };
}

export interface PasswordResetConfirmDatabase {
  $transaction<T>(
    work: (transaction: PasswordResetConfirmTransaction) => Promise<T>,
  ): Promise<T>;
}

/**
 * Claims exactly one still-valid reset credential and changes the password in
 * the same transaction. Any failed step rolls the claim back, so the caller
 * can safely return a retryable result for operational failures.
 */
export async function commitPasswordResetConfirmation(
  database: PasswordResetConfirmDatabase,
  claim: PasswordResetConfirmClaim,
  passwordHash: string,
): Promise<void> {
  await database.$transaction(async (transaction) => {
    // User is the shared serialization point for reset, verification and
    // privileged-account provisioning. Lock it before PasswordReset so every
    // security mutation follows the same global row-lock order.
    const lockedUsers = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM public."User"
      WHERE "id" = ${claim.userId}
      FOR UPDATE
    `;
    if (
      lockedUsers.length !== 1 ||
      lockedUsers[0]?.id !== claim.userId
    ) {
      throw new PasswordResetConfirmConflictError();
    }

    // Lock the exact reset row next. The DB clock is deliberately sampled
    // only after both possible lock waits so a token cannot expire while a
    // worker waits and still be accepted with stale application time.
    const lockedCredentials = await transaction.$queryRaw<
      Array<{
        id: string;
        userId: string;
        token: string | null;
        tokenHash: string | null;
        expires: Date;
      }>
    >`
      SELECT "id", "userId", "token", "tokenHash", "expires"
      FROM public."PasswordReset"
      WHERE "id" = ${claim.id} AND "userId" = ${claim.userId}
      FOR UPDATE
    `;
    const lockedCredential = lockedCredentials[0];
    if (
      lockedCredentials.length !== 1 ||
      !lockedCredential ||
      lockedCredential.id !== claim.id ||
      lockedCredential.userId !== claim.userId
    ) {
      throw new PasswordResetConfirmConflictError();
    }

    const clockRows = await transaction.$queryRaw<
      Array<{ resetAt: Date }>
    >`
      SELECT clock_timestamp()::timestamptz(3) AS "resetAt"
    `;
    const resetAt = clockRows[0]?.resetAt;
    if (
      clockRows.length !== 1 ||
      !(resetAt instanceof Date) ||
      !Number.isFinite(resetAt.getTime()) ||
      !(lockedCredential.expires instanceof Date) ||
      !Number.isFinite(lockedCredential.expires.getTime()) ||
      lockedCredential.expires.getTime() <= resetAt.getTime()
    ) {
      throw new PasswordResetConfirmConflictError();
    }

    const credentialWhere =
      claim.credential.kind === "current-hash"
        ? { tokenHash: claim.credential.storedValue }
        : {
            token: claim.credential.storedValue,
            tokenHash: null,
          };
    const credentialMatches =
      claim.credential.kind === "current-hash"
        ? lockedCredential.tokenHash === claim.credential.storedValue
        : lockedCredential.tokenHash === null &&
          lockedCredential.token === claim.credential.storedValue;
    if (!credentialMatches) {
      throw new PasswordResetConfirmConflictError();
    }

    const updatedUser = await transaction.user.updateMany({
      where: { id: claim.userId },
      data: {
        passwordHash,
        authSessionRevision: { increment: 1 },
      },
    });
    if (updatedUser.count !== 1) {
      throw new PasswordResetConfirmConflictError();
    }

    // The User lock and revision bump make every pre-reset DB-authoritative
    // session stale. Delete both v2 and legacy rows in this same transaction
    // before any reset/verification credential cleanup can complete.
    await transaction.session.deleteMany({
      where: { userId: claim.userId },
    });

    const claimed = await transaction.passwordReset.deleteMany({
      where: {
        id: claim.id,
        userId: claim.userId,
        ...credentialWhere,
      },
    });

    if (claimed.count !== 1) {
      throw new PasswordResetConfirmConflictError();
    }

    await transaction.passwordReset.deleteMany({
      where: { userId: claim.userId },
    });

    // A verification link is also a passwordless session-issuing credential.
    // A successful password reset revokes every older verification link in the
    // same User-first transaction so it cannot recreate a session afterward.
    await transaction.emailVerification.deleteMany({
      where: { userId: claim.userId },
    });
  });
}
