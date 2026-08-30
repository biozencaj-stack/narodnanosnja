const SENSITIVE_CREDENTIAL_PATHS = ["/verify-email", "/newsletter/odjava"];
const SENSITIVE_CREDENTIAL_PREFIXES = [
  "/verify-email/",
  "/reset-password/",
];

/**
 * Pages carrying a bearer credential in their path or query must not mount
 * third-party scripts. Referrer policy cannot stop page-origin JavaScript from
 * reading window.location directly.
 */
export function isSensitiveCredentialPath(pathname: string): boolean {
  return (
    SENSITIVE_CREDENTIAL_PATHS.includes(pathname) ||
    SENSITIVE_CREDENTIAL_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix),
    )
  );
}

/** Unknown routing state is private by default until Next.js resolves it. */
export function shouldLoadThirdPartyScripts(
  pathname: string | null | undefined,
): pathname is string {
  return Boolean(pathname) && !isSensitiveCredentialPath(pathname as string);
}
