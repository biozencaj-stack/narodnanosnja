import {
  parseAuthSessionClaimsV2,
  type AuthSessionClaimsV2,
} from "./session-claims";
import {
  createAuthSessionCookieCleanupPlan,
  type AuthSessionCookieCleanupPlan,
  type AuthSessionCookieName,
} from "./auth-session-cookie-cleanup";

/**
 * `clear` permits a future HTTP route to expire session cookies. `retry` means
 * the database revoke was unavailable, so that route must return a coarse 503
 * and leave every cookie untouched.
 */
type CurrentSessionLogoutResult = "clear" | "retry";

export type CurrentSessionLogoutPlan =
  | Readonly<{
      disposition: "clear";
      cleanup: AuthSessionCookieCleanupPlan;
    }>
  | Readonly<{
      disposition: "retry";
      /** A retry response must never carry cookie-expiry descriptors. */
      cleanup: Readonly<{
        cookies: readonly [];
        hasRemainingRecognizedChunks: false;
      }>;
    }>;

/** Deliberately carries no claims, identifier, token, or adapter error. */
export interface CurrentSessionLogoutReport {
  stage: "REVOKE_UNAVAILABLE" | "COOKIE_CLEANUP_UNAVAILABLE";
}

export interface CurrentSessionLogoutDependencies {
  /** Existing HMAC-backed exact-current-session revoke primitive. */
  revokeCurrent: (
    claims: Readonly<AuthSessionClaimsV2>,
  ) => Promise<"revoked" | "invalid" | "unavailable">;
  /** Optional best-effort observability hook with a coarse-only payload. */
  report?: (event: CurrentSessionLogoutReport) => void;
}

const EMPTY_LOGOUT_COOKIE_CLEANUP = Object.freeze({
  cookies: Object.freeze([]) as readonly [],
  hasRemainingRecognizedChunks: false as const,
});

function retryLogoutPlan(): CurrentSessionLogoutPlan {
  return Object.freeze({
    disposition: "retry" as const,
    cleanup: EMPTY_LOGOUT_COOKIE_CLEANUP,
  });
}

function safelyReport(
  reporter: CurrentSessionLogoutDependencies["report"],
  stage: CurrentSessionLogoutReport["stage"],
): void {
  try {
    reporter?.({ stage });
  } catch {
    // Observability must never change logout safety semantics.
  }
}

async function decideDecodedCurrentSessionLogout(
  decodedClaims: unknown,
  dependencies: CurrentSessionLogoutDependencies,
): Promise<CurrentSessionLogoutResult> {
  let claims: Readonly<AuthSessionClaimsV2> | null;
  try {
    claims = parseAuthSessionClaimsV2(decodedClaims);
  } catch {
    // Malformed and legacy tokens cannot name a V2 DB session. Clearing their
    // browser cookie is safe and must not make a database call.
    return "clear";
  }
  if (!claims) return "clear";

  try {
    const result = await dependencies.revokeCurrent(claims);
    if (result === "revoked" || result === "invalid") return "clear";
  } catch {
    // Dependency exceptions have the same fail-closed outcome as an explicit
    // unavailable result, without exposing the raw adapter error.
  }

  safelyReport(dependencies.report, "REVOKE_UNAVAILABLE");
  return "retry";
}

/**
 * Creates the entire future HTTP logout plan from already-decoded V2 claims.
 *
 * The route that eventually calls this must decrypt/verify the JWE itself and
 * pass only the decoded claim object here; a raw cookie/JWE is never a valid
 * input. For valid V2 claims, database revoke completes before this function
 * asks for any cookie cleanup descriptor. A retry plan always has exactly zero
 * cleanup descriptors. The clear plan preserves whether the bounded cookie
 * batch left recognized chunks for a later request.
 */
export async function createCurrentSessionLogoutPlan(
  decodedClaims: unknown,
  requestCookies: readonly AuthSessionCookieName[] | null | undefined,
  dependencies: CurrentSessionLogoutDependencies,
): Promise<CurrentSessionLogoutPlan> {
  const disposition = await decideDecodedCurrentSessionLogout(
    decodedClaims,
    dependencies,
  );
  if (disposition === "retry") {
    return retryLogoutPlan();
  }

  try {
    return Object.freeze({
      disposition: "clear",
      cleanup: createAuthSessionCookieCleanupPlan(requestCookies),
    });
  } catch {
    // A bounded cleanup-planning error must not be converted into a response
    // that reports successful browser logout. Keep Set-Cookie absent.
    safelyReport(dependencies.report, "COOKIE_CLEANUP_UNAVAILABLE");
    return retryLogoutPlan();
  }
}
