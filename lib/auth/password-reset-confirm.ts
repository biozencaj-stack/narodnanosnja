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
      expires: { gt: Date };
    }
  | {
      id: string;
      userId: string;
      token: string;
      tokenHash: null;
      expires: { gt: Date };
    };

interface PasswordResetConfirmTransaction {
  passwordReset: {
    deleteMany(input: {
      where: PasswordResetClaimWhere | { userId: string };
    }): Promise<{ count: number }>;
  };
  user: {
    update(input: {
      where: { id: string };
      data: { passwordHash: string };
    }): Promise<unknown>;
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
  resetAt: Date,
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const credentialWhere =
      claim.credential.kind === "current-hash"
        ? { tokenHash: claim.credential.storedValue }
        : {
            token: claim.credential.storedValue,
            tokenHash: null,
          };
    const claimed = await transaction.passwordReset.deleteMany({
      where: {
        id: claim.id,
        userId: claim.userId,
        expires: { gt: resetAt },
        ...credentialWhere,
      },
    });

    if (claimed.count !== 1) {
      throw new PasswordResetConfirmConflictError();
    }

    await transaction.user.update({
      where: { id: claim.userId },
      data: { passwordHash },
    });
    await transaction.passwordReset.deleteMany({
      where: { userId: claim.userId },
    });
  });
}
