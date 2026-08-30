import type { PrismaClient, Role } from "@prisma/client";
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
  expectedUser: EmailVerificationExpectedUser;
}

export interface EmailVerificationExpectedUser {
  email: string;
  passwordHash: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export interface StoredEmailVerificationClaimSource {
  id: string;
  userId: string;
  token: string | null;
  tokenHash: string | null;
  user: EmailVerificationExpectedUser;
}

export class EmailVerificationConflictError extends Error {
  constructor() {
    super("Email verification token više nije aktivan");
    this.name = "EmailVerificationConflictError";
  }
}

export class EmailVerificationExpiredError extends Error {
  constructor() {
    super("Email verification token je istekao");
    this.name = "EmailVerificationExpiredError";
  }
}

interface LockedVerificationUserRow extends EmailVerificationExpectedUser {
  id: string;
  emailVerified: Date | null;
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

  return (
    locked.tokenHash === null && locked.token === claim.credential.token
  );
}

function copyExpectedUser(
  user: EmailVerificationExpectedUser,
): EmailVerificationExpectedUser {
  return {
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };
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
      expectedUser: copyExpectedUser(verification.user),
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
    expectedUser: copyExpectedUser(verification.user),
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
): Promise<void> {
  await database.$transaction(async (transaction) => {
    // User is the serialization point shared by verification, resend,
    // privileged provisioning and password-reset security mutations. Read the
    // complete JWT profile under that lock so a session prepared before this
    // commit can only be returned if its email/role/name snapshot is unchanged.
    const lockedUsers = await transaction.$queryRaw<
      LockedVerificationUserRow[]
    >`
      SELECT
        "id",
        "email",
        "passwordHash",
        "role",
        "firstName",
        "lastName",
        "emailVerified"
      FROM public."User"
      WHERE "id" = ${claim.userId}
      FOR UPDATE
    `;

    const lockedUser = lockedUsers[0];
    if (
      lockedUsers.length !== 1 ||
      !lockedUser ||
      !matchesExpectedUser(lockedUser, claim)
    ) {
      throw new EmailVerificationConflictError();
    }

    // Lock the exact token row only after User, preserving the global lock
    // order. Reading it under lock lets us distinguish expiry from replacement
    // without consuming an expired or mismatched credential.
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

    // Sample time after both lock waits. This prevents a credential that
    // expires while waiting for either row from being accepted with a stale
    // pre-wait timestamp. Millisecond precision exactly matches TIMESTAMP(3)
    // auth columns and avoids JS/DB rounding disagreements.
    const clockRows = await transaction.$queryRaw<
      DatabaseVerificationClockRow[]
    >`
      SELECT clock_timestamp()::timestamptz(3) AS "verifiedAt"
    `;
    const verifiedAt = clockRows[0]?.verifiedAt;
    if (clockRows.length !== 1 || !isFiniteDate(verifiedAt)) {
      throw new Error("Invalid email verification database clock");
    }

    if (!isFiniteDate(lockedCredential.expires)) {
      throw new EmailVerificationConflictError();
    }
    if (lockedCredential.expires.getTime() <= verifiedAt.getTime()) {
      throw new EmailVerificationExpiredError();
    }

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
      },
    });

    if (consumed.count !== 1) {
      // Throwing from the interactive transaction also rolls back the user
      // mutation above, so an expired/replaced token can never verify a user.
      throw new EmailVerificationConflictError();
    }

    const verifiedUser = await transaction.user.updateMany({
      where: {
        id: claim.userId,
        emailVerified: null,
        email: claim.expectedUser.email,
        passwordHash: claim.expectedUser.passwordHash,
        role: claim.expectedUser.role,
        firstName: claim.expectedUser.firstName,
        lastName: claim.expectedUser.lastName,
      },
      data: {
        emailVerified: verifiedAt,
        emailVerificationLoginGraceUntil: null,
        verificationEmailNextAllowedAt: null,
        verificationEmailResendWindowStartedAt: null,
        verificationEmailResendCount: null,
      },
    });

    if (verifiedUser.count !== 1) {
      throw new EmailVerificationConflictError();
    }

    await transaction.emailVerification.deleteMany({
      where: { userId: claim.userId },
    });
  });
}
