import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeEmailAddress } from "./email-address";
import {
  hashCredentialToken,
  isCurrentCredentialTokenHash,
  normalizeRawCredentialToken,
} from "./credential-token";

export const EMAIL_VERIFICATION_RESEND_ACCEPTED_MESSAGE =
  "Ako nalog zahteva potvrdu i slanje je trenutno dozvoljeno, novi link biće poslat na unetu email adresu.";
export const EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE =
  "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo.";

export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_WINDOW_MS = 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW = 5;

export type EmailVerificationResendFailureStage =
  | "LOOKUP"
  | "TOKEN_PREPARATION"
  | "DELIVERY_PREPARATION"
  | "TOKEN_REPLACEMENT"
  | "DELIVERY"
  | "SCHEDULING"
  | "BACKGROUND";

export interface EmailVerificationResendFailure {
  stage: EmailVerificationResendFailureStage;
}

export interface EmailVerificationResendUser {
  id: string;
  email: string;
  firstName: string;
  emailVerified: Date | null;
}

export interface EmailVerificationResendTokenInput {
  userId: string;
  expectedEmail: string;
  /** Temporary rollback-compatible plaintext copy; remove after the grace window. */
  legacyPlaintextToken: string;
  /** Preferred, versioned lookup value used by current application code. */
  tokenHash: string;
}

interface LockedEmailVerificationResendUser {
  id: string;
  email: string;
  emailVerified: Date | null;
  verificationEmailNextAllowedAt: Date | null;
  verificationEmailResendWindowStartedAt: Date | null;
  verificationEmailResendCount: number | null;
}

export interface EmailVerificationResendDependencies {
  findUserByEmail: (
    normalizedEmail: string,
  ) => Promise<EmailVerificationResendUser | null>;
  generateToken: () => string;
  hashToken: (token: string) => string | null;
  prepareDelivery: (
    email: string,
    firstName: string,
    token: string,
  ) => () => Promise<void>;
  replaceTokenIfEligible: (
    input: EmailVerificationResendTokenInput,
  ) => Promise<boolean>;
  reportFailure: (failure: EmailVerificationResendFailure) => void;
}

export interface EmailVerificationResendAcceptanceDependencies {
  schedule: (task: () => Promise<void>) => void;
  work: () => Promise<void>;
  reportFailure: (failure: EmailVerificationResendFailure) => void;
}

export interface EmailVerificationResendAcceptedResponse {
  status: 202;
  body: {
    message: typeof EMAIL_VERIFICATION_RESEND_ACCEPTED_MESSAGE;
  };
}

export interface EmailVerificationResendUnavailableResponse {
  status: 503;
  body: {
    error: typeof EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE;
  };
}

export function normalizeEmailVerificationResendEmail(
  value: unknown,
): string | null {
  return normalizeEmailAddress(value);
}

function reportFailureSafely(
  reportFailure: (failure: EmailVerificationResendFailure) => void,
  stage: EmailVerificationResendFailureStage,
): void {
  try {
    // Never pass an email, token or raw exception to production observability.
    reportFailure({ stage });
  } catch {
    // Observability must never create an account-existence oracle.
  }
}

export function emailVerificationResendAcceptedResponse(): EmailVerificationResendAcceptedResponse {
  return {
    status: 202,
    body: { message: EMAIL_VERIFICATION_RESEND_ACCEPTED_MESSAGE },
  };
}

/**
 * Schedules every account-dependent operation and immediately returns the same
 * public result for existing, absent, verified and cooling-down accounts.
 * Next.js `after()` is not a durable queue, so a process crash can still lose
 * accepted background work until a transactional outbox is introduced.
 */
export function acceptEmailVerificationResend(
  dependencies: EmailVerificationResendAcceptanceDependencies,
):
  | EmailVerificationResendAcceptedResponse
  | EmailVerificationResendUnavailableResponse {
  try {
    dependencies.schedule(async () => {
      try {
        await dependencies.work();
      } catch {
        reportFailureSafely(dependencies.reportFailure, "BACKGROUND");
      }
    });
  } catch {
    reportFailureSafely(dependencies.reportFailure, "SCHEDULING");
    return {
      status: 503,
      body: { error: EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE },
    };
  }

  return emailVerificationResendAcceptedResponse();
}

/**
 * Performs private lookup and delivery preparation, then atomically claims the
 * database throttle and adds a credential. SMTP starts only after commit.
 */
export async function processEmailVerificationResend(
  normalizedEmail: string,
  dependencies: EmailVerificationResendDependencies,
): Promise<void> {
  let user: EmailVerificationResendUser | null;

  try {
    user = await dependencies.findUserByEmail(normalizedEmail);
  } catch {
    reportFailureSafely(dependencies.reportFailure, "LOOKUP");
    return;
  }

  if (!user || user.emailVerified !== null) return;

  let token: string;
  let tokenHash: string;

  try {
    const generatedToken = dependencies.generateToken();
    const normalizedToken = normalizeRawCredentialToken(generatedToken);
    if (!normalizedToken || normalizedToken !== generatedToken) {
      throw new Error("Email verification credential is invalid");
    }
    token = normalizedToken;
    const preparedHash = dependencies.hashToken(token);
    const expectedHash = hashCredentialToken("email-verification", token);
    if (
      !isCurrentCredentialTokenHash(preparedHash) ||
      preparedHash !== expectedHash
    ) {
      throw new Error("Email verification credential is invalid");
    }
    tokenHash = preparedHash;
  } catch {
    reportFailureSafely(dependencies.reportFailure, "TOKEN_PREPARATION");
    return;
  }

  let deliver: () => Promise<void>;
  try {
    // Configuration, canonical URL building and all other synchronous delivery
    // preparation must finish before the account cooldown or token is changed.
    deliver = dependencies.prepareDelivery(
      user.email,
      user.firstName,
      token,
    );
  } catch {
    reportFailureSafely(dependencies.reportFailure, "DELIVERY_PREPARATION");
    return;
  }

  let replaced: boolean;
  try {
    replaced = await dependencies.replaceTokenIfEligible({
      userId: user.id,
      expectedEmail: user.email,
      legacyPlaintextToken: token,
      tokenHash,
    });
  } catch {
    reportFailureSafely(dependencies.reportFailure, "TOKEN_REPLACEMENT");
    return;
  }

  // A verified account, changed email, active cooldown or exhausted daily
  // allowance all intentionally collapse to a private no-op and the same 202.
  if (!replaced) return;

  try {
    await deliver();
  } catch {
    // SMTP acceptance can be ambiguous. Keep the committed one-hour token and
    // cooldown so a possibly delivered link remains valid and rate-limited.
    reportFailureSafely(dependencies.reportFailure, "DELIVERY");
  }
}

/**
 * Uses the User row as the serialization point shared by cooldown and a fixed
 * 24-hour allowance. A successful resend keeps every unexpired sibling link,
 * so repeated requests cannot invalidate a link the user already received.
 */
export async function commitEmailVerificationResend(
  database: Pick<PrismaClient, "$transaction">,
  input: EmailVerificationResendTokenInput,
  currentTime: (
    transaction: Prisma.TransactionClient,
  ) => Date | Promise<Date> = readEmailVerificationDatabaseTime,
): Promise<boolean> {
  return database.$transaction(async (transaction) => {
    // Acquire the shared User serialization lock before reading the clock.
    // This preserves User -> EmailVerification ordering and guarantees that
    // lock wait time cannot shorten the cooldown or token lifetime.
    const lockedUsers = await transaction.$queryRaw<
      LockedEmailVerificationResendUser[]
    >`
      SELECT
        "id",
        "email",
        "emailVerified",
        "verificationEmailNextAllowedAt",
        "verificationEmailResendWindowStartedAt",
        "verificationEmailResendCount"
      FROM public."User"
      WHERE "id" = ${input.userId}
      FOR UPDATE
    `;
    if (lockedUsers.length !== 1) return false;
    const lockedUser = lockedUsers[0];
    if (
      lockedUser.email !== input.expectedEmail ||
      lockedUser.emailVerified !== null
    ) {
      return false;
    }

    const issuedAt = await currentTime(transaction);
    const issuedAtMs = issuedAt.getTime();
    if (!Number.isFinite(issuedAtMs)) {
      throw new Error("Invalid email verification resend clock");
    }

    const nextAllowedAtMs =
      lockedUser.verificationEmailNextAllowedAt?.getTime() ?? null;
    if (nextAllowedAtMs !== null && !Number.isFinite(nextAllowedAtMs)) {
      throw new Error("Invalid email verification resend throttle state");
    }
    if (nextAllowedAtMs !== null && nextAllowedAtMs > issuedAtMs) {
      return false;
    }

    const storedWindow =
      lockedUser.verificationEmailResendWindowStartedAt;
    const storedCount = lockedUser.verificationEmailResendCount;
    let nextWindowStartedAt: Date;
    let nextCount: number;

    if (storedWindow === null && storedCount === null) {
      // Legacy rows have no historical counter. Their first post-expand resend
      // starts a fresh fixed window and counts the message being issued now.
      nextWindowStartedAt = issuedAt;
      nextCount = 1;
    } else {
      const storedWindowMs = storedWindow?.getTime() ?? Number.NaN;
      if (
        !Number.isFinite(storedWindowMs) ||
        !Number.isInteger(storedCount) ||
        storedCount === null ||
        storedCount < 1
      ) {
        throw new Error("Invalid email verification resend throttle state");
      }

      const windowExpired =
        issuedAtMs >= storedWindowMs + EMAIL_VERIFICATION_RESEND_WINDOW_MS;
      if (windowExpired) {
        nextWindowStartedAt = issuedAt;
        nextCount = 1;
      } else {
        if (
          storedCount >= EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW
        ) {
          return false;
        }
        nextWindowStartedAt = new Date(storedWindowMs);
        nextCount = storedCount + 1;
      }
    }

    const nextAllowedAt = new Date(
      issuedAtMs + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
    );
    const expires = new Date(
      issuedAtMs + EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS,
    );
    if (
      !Number.isFinite(nextAllowedAt.getTime()) ||
      !Number.isFinite(expires.getTime())
    ) {
      throw new Error("Invalid email verification resend dates");
    }

    const claimed = await transaction.user.updateMany({
      where: {
        id: input.userId,
        email: input.expectedEmail,
        emailVerified: null,
      },
      data: {
        verificationEmailNextAllowedAt: nextAllowedAt,
        verificationEmailResendWindowStartedAt: nextWindowStartedAt,
        verificationEmailResendCount: nextCount,
      },
    });

    if (claimed.count !== 1) return false;

    await transaction.emailVerification.deleteMany({
      where: {
        userId: input.userId,
        expires: { lte: issuedAt },
      },
    });
    await transaction.emailVerification.create({
      data: {
        userId: input.userId,
        token: input.legacyPlaintextToken,
        tokenHash: input.tokenHash,
        expires,
      },
    });

    return true;
  });
}

async function readEmailVerificationDatabaseTime(
  transaction: Prisma.TransactionClient,
): Promise<Date> {
  const rows = await transaction.$queryRaw<
    Array<{ currentTimestamp: Date }>
  >`SELECT clock_timestamp() AS "currentTimestamp"`;
  const currentTimestamp = rows[0]?.currentTimestamp;
  if (rows.length !== 1 || !(currentTimestamp instanceof Date)) {
    throw new Error("Invalid email verification resend database clock");
  }

  return currentTimestamp;
}
