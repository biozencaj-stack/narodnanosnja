import { createHmac, timingSafeEqual } from "node:crypto";
import { validateEmailAddress } from "@/lib/utils/validation";

const MIN_SECRET_BYTES = 32;
const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

export const NEWSLETTER_UNSUBSCRIBE_PATH = "/newsletter/odjava";

export type NewsletterUnsubscribeEnvironment = Readonly<
  Record<string, string | undefined>
>;

export class NewsletterUnsubscribeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsletterUnsubscribeConfigurationError";
  }
}

interface ResolvedSecrets {
  signingSecret: string;
  verificationSecrets: string[];
}

function configuredSecret(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function assertStrongSecret(secret: string, variableName: string): void {
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new NewsletterUnsubscribeConfigurationError(
      `${variableName} mora imati najmanje ${MIN_SECRET_BYTES} bajta`,
    );
  }
}

function acceptLegacyNextAuthSecret(
  environment: NewsletterUnsubscribeEnvironment,
): boolean {
  const configuredValue =
    environment.NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY?.trim().toLowerCase();
  if (!configuredValue) return false;
  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;

  throw new NewsletterUnsubscribeConfigurationError(
    "NEWSLETTER_UNSUBSCRIBE_ACCEPT_NEXTAUTH_LEGACY mora biti true ili false",
  );
}

function resolveSecrets(
  environment: NewsletterUnsubscribeEnvironment,
): ResolvedSecrets {
  const dedicatedSecret = configuredSecret(
    environment.NEWSLETTER_UNSUBSCRIBE_SECRET,
  );
  const nextAuthSecret = configuredSecret(environment.NEXTAUTH_SECRET);

  if (dedicatedSecret) {
    // A configured but weak dedicated secret is an error. Silently falling
    // back would conceal a broken production configuration.
    assertStrongSecret(dedicatedSecret, "NEWSLETTER_UNSUBSCRIBE_SECRET");

    const verificationSecrets = [dedicatedSecret];
    if (
      acceptLegacyNextAuthSecret(environment) &&
      nextAuthSecret &&
      nextAuthSecret !== dedicatedSecret &&
      Buffer.byteLength(nextAuthSecret, "utf8") >= MIN_SECRET_BYTES
    ) {
      // Transitional compatibility for links sent before the dedicated
      // newsletter secret was introduced. The explicit flag gives operations
      // a deterministic way to end this migration window.
      verificationSecrets.push(nextAuthSecret);
    }

    return { signingSecret: dedicatedSecret, verificationSecrets };
  }

  if (!nextAuthSecret) {
    throw new NewsletterUnsubscribeConfigurationError(
      "NEWSLETTER_UNSUBSCRIBE_SECRET ili NEXTAUTH_SECRET mora biti podešen",
    );
  }

  assertStrongSecret(nextAuthSecret, "NEXTAUTH_SECRET");
  return {
    signingSecret: nextAuthSecret,
    verificationSecrets: [nextAuthSecret],
  };
}

export function normalizeNewsletterEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;

  const normalizedEmail = email.trim().toLowerCase();
  return validateEmailAddress(normalizedEmail) ? normalizedEmail : null;
}

function signEmail(email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(email)
    .digest("hex")
    .slice(0, 32);
}

export function createNewsletterUnsubscribeToken(
  email: string,
  environment: NewsletterUnsubscribeEnvironment = process.env,
): string {
  const normalizedEmail = normalizeNewsletterEmail(email);
  if (!normalizedEmail) {
    throw new TypeError("Email adresa za newsletter odjavu nije validna");
  }

  const { signingSecret } = resolveSecrets(environment);
  return signEmail(normalizedEmail, signingSecret);
}

/**
 * Returns the normalized email only when the bearer token is valid. Secret
 * configuration errors intentionally propagate so callers can fail closed.
 */
export function verifyNewsletterUnsubscribeToken(
  email: unknown,
  token: unknown,
  environment: NewsletterUnsubscribeEnvironment = process.env,
): string | null {
  const normalizedEmail = normalizeNewsletterEmail(email);
  if (
    !normalizedEmail ||
    typeof token !== "string" ||
    !TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  const { verificationSecrets } = resolveSecrets(environment);
  const suppliedToken = Buffer.from(token, "utf8");
  let matches = false;

  for (const secret of verificationSecrets) {
    const expectedToken = Buffer.from(signEmail(normalizedEmail, secret), "utf8");
    const candidateMatches = timingSafeEqual(suppliedToken, expectedToken);
    matches = candidateMatches || matches;
  }

  return matches ? normalizedEmail : null;
}

export function createNewsletterUnsubscribeUrl(
  storefrontUrl: URL,
  email: string,
  environment: NewsletterUnsubscribeEnvironment = process.env,
): string {
  const normalizedEmail = normalizeNewsletterEmail(email);
  if (!normalizedEmail) {
    throw new TypeError("Email adresa za newsletter odjavu nije validna");
  }

  const url = new URL(NEWSLETTER_UNSUBSCRIBE_PATH, storefrontUrl);
  url.searchParams.set("email", normalizedEmail);
  url.searchParams.set(
    "token",
    createNewsletterUnsubscribeToken(normalizedEmail, environment),
  );
  return url.toString();
}

export async function unsubscribeNewsletterWithToken(
  input: { email: unknown; token: unknown },
  deactivate: (normalizedEmail: string) => Promise<void>,
  environment: NewsletterUnsubscribeEnvironment = process.env,
): Promise<boolean> {
  const normalizedEmail = verifyNewsletterUnsubscribeToken(
    input.email,
    input.token,
    environment,
  );
  if (!normalizedEmail) return false;

  await deactivate(normalizedEmail);
  return true;
}
