import type { AuthoritativeSessionPrincipal } from "./authoritative-session-database";
import {
  readAuthSessionCookie,
  type AuthSessionRequestCookie,
} from "./auth-session-cookie-reader";
import type { AuthSessionClaimsV2 } from "./session-claims-edge";
import { extractAuthSessionClaimsV2 } from "./session-jwt";

/**
 * A deliberately small, transport-safe projection of the principal returned
 * by the authoritative Session lookup. It never includes a JWT, claims, SID,
 * database record or adapter error.
 */
export interface AuthoritativeSessionGuardPrincipal {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: "CUSTOMER" | "OPERATOR" | "ADMIN";
  requiresEmailVerification: boolean;
}

export type AuthoritativeSessionResolution =
  | Readonly<{
      status: "authenticated";
      principal: Readonly<AuthoritativeSessionGuardPrincipal>;
    }>
  | Readonly<{
      status: "anonymous";
      reason: "missing" | "invalid";
    }>
  | Readonly<{
      status: "unavailable";
    }>;

/** Observability is coarse by construction and may never carry session data. */
export interface AuthoritativeSessionGuardReport {
  stage: "VALIDATION_UNAVAILABLE" | "REQUEST_CONTEXT";
}

export interface AuthoritativeSessionGuardDependencies {
  secret: string;
  activeCookieName: string;
  decode: (input: {
    token: string;
    secret: string;
  }) => Promise<unknown>;
  validate: (
    claims: Readonly<AuthSessionClaimsV2>,
  ) => Promise<
    | { status: "valid"; principal: AuthoritativeSessionPrincipal }
    | { status: "invalid" }
    | { status: "unavailable" }
  >;
  report?: (event: AuthoritativeSessionGuardReport) => void;
}

export const ANONYMOUS_MISSING_AUTH_SESSION = Object.freeze({
  status: "anonymous" as const,
  reason: "missing" as const,
});

export const ANONYMOUS_INVALID_AUTH_SESSION = Object.freeze({
  status: "anonymous" as const,
  reason: "invalid" as const,
});

export const UNAVAILABLE_AUTH_SESSION = Object.freeze({
  status: "unavailable" as const,
});

function safelyReport(
  reporter: AuthoritativeSessionGuardDependencies["report"],
): void {
  try {
    reporter?.({ stage: "VALIDATION_UNAVAILABLE" });
  } catch {
    // A telemetry outage cannot alter an authorization result.
  }
}

function isSafePrincipalString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function normalizePrincipal(
  value: unknown,
): Readonly<AuthoritativeSessionGuardPrincipal> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  try {
    const principal = value as Partial<AuthoritativeSessionPrincipal>;
    if (
      !isSafePrincipalString(principal.id) ||
      !isSafePrincipalString(principal.email) ||
      !isSafePrincipalString(principal.firstName) ||
      !isSafePrincipalString(principal.lastName) ||
      !["CUSTOMER", "OPERATOR", "ADMIN"].includes(principal.role ?? "") ||
      typeof principal.requiresEmailVerification !== "boolean"
    ) {
      return null;
    }

    // Derive name from the independently checked fields rather than trusting a
    // dependency-supplied display projection. This also drops every unknown
    // property before the principal reaches an access decision.
    return Object.freeze({
      id: principal.id,
      email: principal.email,
      firstName: principal.firstName,
      lastName: principal.lastName,
      name: `${principal.firstName} ${principal.lastName}`.trim(),
      role: principal.role as AuthoritativeSessionGuardPrincipal["role"],
      requiresEmailVerification: principal.requiresEmailVerification,
    });
  } catch {
    return null;
  }
}

function authenticatedResolution(
  principal: Readonly<AuthoritativeSessionGuardPrincipal>,
): AuthoritativeSessionResolution {
  return Object.freeze({ status: "authenticated" as const, principal });
}

/** Narrows a frozen resolution for Node route/layout access decisions. */
export function isAuthenticatedAuthoritativeSession(
  resolution: AuthoritativeSessionResolution,
): resolution is Extract<
  AuthoritativeSessionResolution,
  { status: "authenticated" }
> {
  return resolution.status === "authenticated";
}

/** Distinguishes a retryable dependency failure from an anonymous request. */
export function isAuthoritativeSessionUnavailable(
  resolution: AuthoritativeSessionResolution,
): resolution is Extract<
  AuthoritativeSessionResolution,
  { status: "unavailable" }
> {
  return resolution.status === "unavailable";
}

/**
 * Builds a Node-only, database-authoritative session reader.
 *
 * The sole accepted credential source is the supplied exact V2 cookie list.
 * It intentionally has no request/header argument, so an Authorization bearer
 * token cannot become a fallback credential.
 */
export function createAuthoritativeSessionGuard(
  dependencies: AuthoritativeSessionGuardDependencies,
) {
  return {
    async resolve(
      cookies: readonly AuthSessionRequestCookie[] | null | undefined,
    ): Promise<AuthoritativeSessionResolution> {
      const cookie = readAuthSessionCookie(cookies, dependencies.activeCookieName);
      if (cookie.status === "missing") return ANONYMOUS_MISSING_AUTH_SESSION;
      if (cookie.status !== "present" || typeof cookie.token !== "string") {
        return ANONYMOUS_INVALID_AUTH_SESSION;
      }

      let decoded: unknown;
      try {
        decoded = await dependencies.decode({
          token: cookie.token,
          secret: dependencies.secret,
        });
      } catch {
        // The reviewed default decoder is total, but an injected decoder must
        // never turn a malformed browser credential into an infrastructure
        // signal or expose an error.
        return ANONYMOUS_INVALID_AUTH_SESSION;
      }
      let claims: Readonly<AuthSessionClaimsV2> | null;
      try {
        claims = extractAuthSessionClaimsV2(decoded);
      } catch {
        return ANONYMOUS_INVALID_AUTH_SESSION;
      }
      if (!claims) return ANONYMOUS_INVALID_AUTH_SESSION;

      let validation: Awaited<ReturnType<AuthoritativeSessionGuardDependencies["validate"]>>;
      try {
        validation = await dependencies.validate(claims);
      } catch {
        safelyReport(dependencies.report);
        return UNAVAILABLE_AUTH_SESSION;
      }

      if (validation?.status === "invalid") {
        return ANONYMOUS_INVALID_AUTH_SESSION;
      }
      if (validation?.status !== "valid") {
        safelyReport(dependencies.report);
        return UNAVAILABLE_AUTH_SESSION;
      }

      const principal = normalizePrincipal(validation.principal);
      if (!principal) {
        safelyReport(dependencies.report);
        return UNAVAILABLE_AUTH_SESSION;
      }
      return authenticatedResolution(principal);
    },
  };
}
