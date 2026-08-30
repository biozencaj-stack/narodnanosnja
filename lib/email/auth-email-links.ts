import { normalizeRawCredentialToken } from "../auth/credential-token";

function createCredentialUrl(
  storefrontUrl: URL,
  pathPrefix: "/verify-email/" | "/reset-password/",
  rawToken: unknown,
): string | null {
  const token = normalizeRawCredentialToken(rawToken);
  if (!token) return null;

  return new URL(
    `${pathPrefix}${encodeURIComponent(token)}`,
    storefrontUrl,
  ).toString();
}

export function createEmailVerificationUrl(
  storefrontUrl: URL,
  rawToken: unknown,
): string | null {
  return createCredentialUrl(storefrontUrl, "/verify-email/", rawToken);
}

export function createPasswordResetUrl(
  storefrontUrl: URL,
  rawToken: unknown,
): string | null {
  return createCredentialUrl(storefrontUrl, "/reset-password/", rawToken);
}
