export const PASSWORD_RESET_ACCEPTED_MESSAGE =
  "Ako nalog postoji, uputstva za reset lozinke biće poslata na unetu email adresu.";
export const PASSWORD_RESET_UNAVAILABLE_MESSAGE =
  "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo.";

export const PASSWORD_RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export type PasswordResetFailureStage =
  | "LOOKUP"
  | "TOKEN_REPLACEMENT"
  | "DELIVERY"
  | "SCHEDULING"
  | "BACKGROUND";

export interface PasswordResetFailure {
  stage: PasswordResetFailureStage;
}

export interface PasswordResetUser {
  id: string;
  email: string;
  firstName: string;
}

export interface PasswordResetTokenInput {
  userId: string;
  token: string;
  expires: Date;
}

export interface PasswordResetRequestDependencies {
  findUserByEmail: (email: string) => Promise<PasswordResetUser | null>;
  generateToken: () => string;
  now: () => Date;
  replaceTokensForRequest: (input: PasswordResetTokenInput) => Promise<void>;
  sendResetEmail: (
    email: string,
    firstName: string,
    token: string,
  ) => Promise<void>;
  reportFailure: (failure: PasswordResetFailure) => void;
}

export interface PasswordResetAcceptanceDependencies {
  schedule: (task: () => Promise<void>) => void;
  work: () => Promise<void>;
  reportFailure: (failure: PasswordResetFailure) => void;
}

export interface PasswordResetAcceptedResponse {
  status: 202;
  body: {
    message: typeof PASSWORD_RESET_ACCEPTED_MESSAGE;
  };
}

export interface PasswordResetUnavailableResponse {
  status: 503;
  body: {
    error: typeof PASSWORD_RESET_UNAVAILABLE_MESSAGE;
  };
}

export function normalizePasswordResetEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function passwordResetAcceptedResponse(): PasswordResetAcceptedResponse {
  return {
    status: 202,
    body: { message: PASSWORD_RESET_ACCEPTED_MESSAGE },
  };
}

function reportFailureSafely(
  reportFailure: (failure: PasswordResetFailure) => void,
  stage: PasswordResetFailureStage,
): void {
  try {
    reportFailure({ stage });
  } catch {
    // Observability must never turn an enumeration-safe response into an oracle.
  }
}

/**
 * Schedules all account-dependent work and returns the public response without
 * waiting for a lookup, token write, or SMTP delivery. The scheduler used by
 * the route is Next.js `after()`, not a durable queue; a process crash can still
 * lose scheduled work until a transactional outbox is introduced.
 */
export function acceptPasswordResetRequest(
  dependencies: PasswordResetAcceptanceDependencies,
): PasswordResetAcceptedResponse | PasswordResetUnavailableResponse {
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
      body: { error: PASSWORD_RESET_UNAVAILABLE_MESSAGE },
    };
  }

  return passwordResetAcceptedResponse();
}

/**
 * Performs the private account lookup, per-request atomic token replacement,
 * and email delivery. Every expected failure is reduced to a stage-only
 * observation.
 */
export async function processPasswordResetRequest(
  normalizedEmail: string,
  dependencies: PasswordResetRequestDependencies,
): Promise<void> {
  let user: PasswordResetUser | null;

  try {
    user = await dependencies.findUserByEmail(normalizedEmail);
  } catch {
    reportFailureSafely(dependencies.reportFailure, "LOOKUP");
    return;
  }

  if (!user) return;

  let token: string;

  try {
    token = dependencies.generateToken();
    if (token.length < 32) {
      throw new Error("Password reset token generator returned a short token");
    }

    const expires = new Date(
      dependencies.now().getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS,
    );
    await dependencies.replaceTokensForRequest({
      userId: user.id,
      token,
      expires,
    });
  } catch {
    reportFailureSafely(dependencies.reportFailure, "TOKEN_REPLACEMENT");
    return;
  }

  try {
    await dependencies.sendResetEmail(user.email, user.firstName, token);
  } catch {
    // SMTP failure can be ambiguous after remote acceptance. Keep the
    // committed, one-hour token so a possibly delivered link remains valid.
    reportFailureSafely(dependencies.reportFailure, "DELIVERY");
  }
}
