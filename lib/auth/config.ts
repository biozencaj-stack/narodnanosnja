const MIN_AUTH_SECRET_BYTES = 32;
const KNOWN_INSECURE_AUTH_SECRETS = new Set([
  "promeni-me-nasumicnim-nizom-od-najmanje-32-bajta",
  "your-secret-key-here-change-in-production",
]);

export const AUTH_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Canonical host-only base names for the legacy and future V2 auth cookies.
 * A future V2 cutover must configure its issuer/decoder from this contract;
 * logout cleanup deliberately covers every entry during migration.
 */
export const AUTH_SESSION_COOKIE_BASE_NAMES = Object.freeze([
  "next-auth.v2.session-token",
  "__Secure-next-auth.v2.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const);

/** Browser cookie limits leave ample room for 1,000 canonical chunk indices. */
export const MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX = 999;

export const VERIFIED_LOGIN_POLICIES = [
  "audit",
  "staged",
  "strict",
] as const;

export type VerifiedLoginPolicy = (typeof VERIFIED_LOGIN_POLICIES)[number];

export const VERIFIED_LOGIN_MAX_GRACE_WINDOW_MS =
  30 * 24 * 60 * 60 * 1_000;

const CANONICAL_UTC_MILLISECOND_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type AuthEnvironment = Readonly<Record<string, string | undefined>>;

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Resolves the one signing secret shared by NextAuth, proxy token decoding and
 * the post-verification session. Missing, ambiguous or short values fail
 * closed instead of silently creating incompatible JWTs.
 */
export function resolveAuthSecret(
  environment: AuthEnvironment = process.env,
): string {
  const secret = environment.NEXTAUTH_SECRET;

  if (typeof secret !== "string" || !secret.trim()) {
    throw new AuthConfigurationError(
      "NEXTAUTH_SECRET mora biti podešen",
    );
  }

  if (secret.trim() !== secret) {
    throw new AuthConfigurationError(
      "NEXTAUTH_SECRET ne sme imati početne ili završne razmake",
    );
  }

  if (utf8ByteLength(secret) < MIN_AUTH_SECRET_BYTES) {
    throw new AuthConfigurationError(
      `NEXTAUTH_SECRET mora imati najmanje ${MIN_AUTH_SECRET_BYTES} bajta`,
    );
  }

  if (KNOWN_INSECURE_AUTH_SECRETS.has(secret)) {
    throw new AuthConfigurationError(
      "NEXTAUTH_SECRET mora biti nov, kriptografski nasumičan ključ",
    );
  }

  return secret;
}

/**
 * Controls whether a password-valid account must also have a verified email.
 *
 * Production requires an explicit value so a missing deployment setting can
 * never silently disable enforcement. Development and tests retain the
 * compatibility-safe audit default when the variable is genuinely absent.
 */
export function resolveVerifiedLoginPolicy(
  environment: AuthEnvironment = process.env,
): VerifiedLoginPolicy {
  const configuredPolicy = environment.AUTH_VERIFIED_LOGIN_POLICY;

  if (configuredPolicy === undefined) {
    if (environment.NODE_ENV === "production") {
      throw new AuthConfigurationError(
        "AUTH_VERIFIED_LOGIN_POLICY mora biti podešen u produkciji",
      );
    }
    return "audit";
  }

  if (
    configuredPolicy.length === 0 ||
    configuredPolicy.trim() !== configuredPolicy
  ) {
    throw new AuthConfigurationError(
      "AUTH_VERIFIED_LOGIN_POLICY mora biti audit, staged ili strict bez okolnih razmaka",
    );
  }

  if (
    !VERIFIED_LOGIN_POLICIES.includes(
      configuredPolicy as VerifiedLoginPolicy,
    )
  ) {
    throw new AuthConfigurationError(
      "AUTH_VERIFIED_LOGIN_POLICY mora biti audit, staged ili strict",
    );
  }

  return configuredPolicy as VerifiedLoginPolicy;
}

/**
 * Resolves the one reviewed rollout deadline used by staged login.
 *
 * The exact UTC millisecond form matches the read-only PostgreSQL preflight.
 * Maximum duration is evaluated later against the same fresh DB clock as the
 * account policy, never against the application process clock.
 */
export function resolveVerifiedLoginGraceDeadline(
  policy: VerifiedLoginPolicy,
  environment: AuthEnvironment = process.env,
): Date | null {
  const configuredDeadline =
    environment.AUTH_VERIFIED_LOGIN_GRACE_DEADLINE;

  if (configuredDeadline === undefined) {
    if (policy === "staged") {
      throw new AuthConfigurationError(
        "AUTH_VERIFIED_LOGIN_GRACE_DEADLINE je obavezan za staged politiku",
      );
    }
    return null;
  }

  if (
    !CANONICAL_UTC_MILLISECOND_PATTERN.test(configuredDeadline)
  ) {
    throw new AuthConfigurationError(
      "AUTH_VERIFIED_LOGIN_GRACE_DEADLINE mora biti kanonski UTC timestamp sa milisekundama",
    );
  }

  const deadline = new Date(configuredDeadline);
  if (
    !Number.isFinite(deadline.getTime()) ||
    deadline.toISOString() !== configuredDeadline
  ) {
    throw new AuthConfigurationError(
      "AUTH_VERIFIED_LOGIN_GRACE_DEADLINE nije validan UTC timestamp",
    );
  }

  return deadline;
}

export function shouldUseSecureAuthCookies(
  environment: AuthEnvironment = process.env,
): boolean {
  const configuredUrl = environment.NEXTAUTH_URL;

  if (!configuredUrl) {
    if (environment.NODE_ENV === "production") {
      throw new AuthConfigurationError(
        "NEXTAUTH_URL mora biti podešen na HTTPS adresu u produkciji",
      );
    }
    return false;
  }

  if (configuredUrl.trim() !== configuredUrl) {
    throw new AuthConfigurationError(
      "NEXTAUTH_URL ne sme imati početne ili završne razmake",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new AuthConfigurationError("NEXTAUTH_URL nije validna adresa");
  }

  if (parsedUrl.protocol === "https:") return true;
  if (parsedUrl.protocol === "http:") {
    if (environment.NODE_ENV === "production") {
      throw new AuthConfigurationError(
        "NEXTAUTH_URL mora koristiti HTTPS u produkciji",
      );
    }
    return false;
  }

  throw new AuthConfigurationError("NEXTAUTH_URL mora koristiti HTTP ili HTTPS");
}

export function authSessionCookieName(
  environment: AuthEnvironment = process.env,
): string {
  return shouldUseSecureAuthCookies(environment)
    ? AUTH_SESSION_COOKIE_BASE_NAMES[3]
    : AUTH_SESSION_COOKIE_BASE_NAMES[2];
}

/** Future V2 issuer/decoder name, derived from the cleanup name contract. */
export function authSessionV2CookieName(
  environment: AuthEnvironment = process.env,
): string {
  return shouldUseSecureAuthCookies(environment)
    ? AUTH_SESSION_COOKIE_BASE_NAMES[1]
    : AUTH_SESSION_COOKIE_BASE_NAMES[0];
}
