import type { PrismaClient } from "@prisma/client";

export interface EmailVerificationClaim {
  id: string;
  userId: string;
  token: string;
}

export class EmailVerificationConflictError extends Error {
  constructor() {
    super("Email verification token više nije aktivan");
    this.name = "EmailVerificationConflictError";
  }
}

/**
 * A verification request may mutate user/token rows only after session
 * encoding and complete success-response preparation both succeed. The
 * prepared result is returned only after the atomic DB commit also succeeds.
 */
export async function prepareVerificationSuccessBeforeCommit<TResult>(
  issueSessionToken: () => Promise<string>,
  prepareSuccessResult: (sessionToken: string) => Promise<TResult> | TResult,
  commitVerification: () => Promise<void>,
): Promise<TResult> {
  const sessionToken = await issueSessionToken();
  const successResult = await prepareSuccessResult(sessionToken);
  await commitVerification();
  return successResult;
}

/**
 * Claims one still-valid token and verifies its user in a single transaction.
 * A successful claim also invalidates every sibling verification link.
 */
export async function commitEmailVerification(
  database: Pick<PrismaClient, "$transaction">,
  claim: EmailVerificationClaim,
  verifiedAt = new Date(),
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const consumed = await transaction.emailVerification.deleteMany({
      where: {
        id: claim.id,
        userId: claim.userId,
        token: claim.token,
        expires: { gt: verifiedAt },
      },
    });

    if (consumed.count !== 1) {
      throw new EmailVerificationConflictError();
    }

    await transaction.user.update({
      where: { id: claim.userId },
      data: { emailVerified: verifiedAt },
    });

    await transaction.emailVerification.deleteMany({
      where: { userId: claim.userId },
    });
  });
}
