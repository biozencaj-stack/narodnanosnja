const MIN_AUTH_SECRET_BYTES = 32;
const KNOWN_INSECURE_AUTH_SECRETS = new Set([
  "promeni-me-nasumicnim-nizom-od-najmanje-32-bajta",
  "your-secret-key-here-change-in-production",
]);

export const AUTH_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

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
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}
