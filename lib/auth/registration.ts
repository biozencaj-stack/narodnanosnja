import {
  hashCredentialToken,
  isCurrentCredentialTokenHash,
  normalizeRawCredentialToken,
} from "./credential-token";
import { normalizeEmailAddress } from "./email-address";

export const REGISTRATION_VERIFICATION_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
export const REGISTRATION_VERIFICATION_COOLDOWN_MS = 60 * 1000;
export const REGISTRATION_VERIFICATION_INITIAL_EMAIL_COUNT = 1;

export interface RegistrationInput {
  normalizedEmail: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  legacyPlaintextToken: string;
  tokenHash: string;
  issuedAt: Date;
}

export interface RegistrationUserWrite {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerificationLoginGraceUntil: null;
  verificationEmailNextAllowedAt: Date;
  verificationEmailResendWindowStartedAt: Date;
  verificationEmailResendCount: number;
}

export interface RegistrationVerificationWrite {
  userId: string;
  /** Temporary rollback-compatible plaintext copy; remove after grace. */
  legacyPlaintextToken: string;
  /** Preferred, versioned lookup value used by current application code. */
  tokenHash: string;
  expires: Date;
}

export interface RegistrationTransaction {
  createUser: (input: RegistrationUserWrite) => Promise<{ id: string }>;
  createEmailVerification: (
    input: RegistrationVerificationWrite,
  ) => Promise<void>;
}

export interface RegistrationDatabase {
  transaction: <T>(
    work: (transaction: RegistrationTransaction) => Promise<T>,
  ) => Promise<T>;
  findUserByEmail: (normalizedEmail: string) => Promise<{ id: string } | null>;
}

export type RegistrationResult =
  | { kind: "created" }
  | { kind: "existing" };

export function isUniqueConstraintFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Creates the user and its initial verification credential as one atomic unit.
 *
 * The unique-email race is resolved only after the failed transaction rolls
 * back. A unique token/hash collision has no matching account and is rethrown,
 * so it can never be misreported as an already-existing email address.
 */
export async function registerAccount(
  input: RegistrationInput,
  database: RegistrationDatabase,
): Promise<RegistrationResult> {
  const issuedAtTime =
    input.issuedAt instanceof Date ? input.issuedAt.getTime() : Number.NaN;
  const normalizedToken = normalizeRawCredentialToken(
    input.legacyPlaintextToken,
  );
  const expectedTokenHash = hashCredentialToken(
    "email-verification",
    normalizedToken,
  );
  if (
    normalizeEmailAddress(input.normalizedEmail) !== input.normalizedEmail ||
    typeof input.passwordHash !== "string" ||
    !input.passwordHash.trim() ||
    typeof input.firstName !== "string" ||
    !input.firstName.trim() ||
    typeof input.lastName !== "string" ||
    !input.lastName.trim() ||
    (input.phone !== null && typeof input.phone !== "string") ||
    normalizedToken !== input.legacyPlaintextToken ||
    !isCurrentCredentialTokenHash(input.tokenHash) ||
    expectedTokenHash !== input.tokenHash ||
    !(input.issuedAt instanceof Date) ||
    !Number.isFinite(issuedAtTime)
  ) {
    throw new Error("Invalid prepared registration input");
  }

  const verificationEmailNextAllowedAt = new Date(
    issuedAtTime + REGISTRATION_VERIFICATION_COOLDOWN_MS,
  );
  const verificationEmailResendWindowStartedAt = new Date(issuedAtTime);
  const expires = new Date(
    issuedAtTime + REGISTRATION_VERIFICATION_TOKEN_LIFETIME_MS,
  );
  if (
    !Number.isFinite(verificationEmailNextAllowedAt.getTime()) ||
    !Number.isFinite(verificationEmailResendWindowStartedAt.getTime()) ||
    !Number.isFinite(expires.getTime())
  ) {
    throw new Error("Invalid prepared registration dates");
  }

  try {
    await database.transaction(async (transaction) => {
      const user = await transaction.createUser({
        email: input.normalizedEmail,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        // Grace is reserved for explicitly reviewed legacy CUSTOMER rows.
        // A newly registered account must always verify its mailbox.
        emailVerificationLoginGraceUntil: null,
        verificationEmailNextAllowedAt,
        verificationEmailResendWindowStartedAt,
        verificationEmailResendCount:
          REGISTRATION_VERIFICATION_INITIAL_EMAIL_COUNT,
      });

      await transaction.createEmailVerification({
        userId: user.id,
        legacyPlaintextToken: input.legacyPlaintextToken,
        tokenHash: input.tokenHash,
        expires,
      });
    });

    return { kind: "created" };
  } catch (error) {
    if (!isUniqueConstraintFailure(error)) throw error;

    const existing = await database.findUserByEmail(input.normalizedEmail);
    if (existing) return { kind: "existing" };

    // The collision was not caused by User.email (for example, an extremely
    // unlikely token/hash collision). Preserve retryable failure semantics.
    throw error;
  }
}
