import { shouldLoadThirdPartyScripts } from "@/lib/security/credential-path";

/**
 * Verification URLs contain a one-time credential and must never be sent to
 * analytics. Treat an unknown pathname as private until Next.js resolves it.
 */
export function shouldTrackGoogleAnalyticsPath(
  pathname: string | null | undefined,
): pathname is string {
  return shouldLoadThirdPartyScripts(pathname);
}
