import type { PrismaClient } from "@prisma/client";
import {
  isCurrentCredentialTokenHash,
  normalizeRawCredentialToken,
} from "./credential-token";

export type EmailVerificationStoredCredential =
  | { kind: "hash"; tokenHash: string }
  | { kind: "legacy"; token: string };

export interface EmailVerificationClaim {
  id: string;
  userId: string;
  credential: EmailVerificationStoredCredential;
}

export interface StoredEmailVerificationClaimSource {
  id: string;
  userId: string;
  token: string | null;
  tokenHash: string | null;
}

export class EmailVerificationConflictError extends Error {
  constructor() {
    super("Email verification token više nije aktivan");
    this.name = "EmailVerificationConflictError";
  }
}

/**
 * Builds a claim only from the credential that was actually read from storage.
 * Current hashes always win over the temporary plaintext compatibility copy.
 */
export function createStoredEmailVerificationClaim(
  verification: StoredEmailVerificationClaimSource,
): EmailVerificationClaim | null {
  if (isCurrentCredentialTokenHash(verification.tokenHash)) {
    return {
      id: verification.id,
      userId: verification.userId,
      credential: { kind: "hash", tokenHash: verification.tokenHash },
    };
  }

  // Once a row has any current-column value, never silently accept its
  // rollback-only plaintext copy when the expected hash lookup did not match.
  if (verification.tokenHash !== null) return null;

  const legacyToken = normalizeRawCredentialToken(verification.token);
  if (!legacyToken || verification.token !== legacyToken) return null;

  return {
    id: verification.id,
    userId: verification.userId,
    credential: { kind: "legacy", token: verification.token },
  };
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
    const storedCredential =
      claim.credential.kind === "hash"
        ? { tokenHash: claim.credential.tokenHash }
        : {
            token: claim.credential.token,
            // A legacy lookup is valid only while the current hash column is
            // still empty. Preserve that exact invariant at claim time so a
            // concurrent backfill cannot turn plaintext into a downgrade path.
            tokenHash: null,
          };
    const consumed = await transaction.emailVerification.deleteMany({
      where: {
        id: claim.id,
        userId: claim.userId,
        ...storedCredential,
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
