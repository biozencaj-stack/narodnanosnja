import {
  getAdminApiAccess,
  getAdminPageAccess,
  type AdminAccessDenialReason,
  type AdminRole,
} from "./admin-policy";
import type {
  AuthoritativeSessionGuardPrincipal,
  AuthoritativeSessionResolution,
} from "./authoritative-session-guard";

export type CustomerApiSessionAccess =
  | Readonly<{
      status: "ok";
      principal: Readonly<AuthoritativeSessionGuardPrincipal>;
    }>
  | Readonly<{
      status: "unauthenticated";
      reason: "missing" | "invalid";
    }>
  | Readonly<{
      status: "unavailable";
    }>;

type AdminForbiddenReason = Exclude<
  AdminAccessDenialReason,
  "UNAUTHENTICATED"
>;

export type AdminSessionAccess =
  | Readonly<{
      status: "ok";
      principal: Readonly<AuthoritativeSessionGuardPrincipal>;
      role: AdminRole;
    }>
  | Readonly<{
      status: "unauthenticated";
      reason: "missing" | "invalid";
    }>
  | Readonly<{
      status: "forbidden";
      reason: AdminForbiddenReason;
    }>
  | Readonly<{
      status: "unavailable";
    }>;

function mapAnonymous(
  resolution: Extract<
    AuthoritativeSessionResolution,
    Readonly<{ status: "anonymous" }>
  >,
): CustomerApiSessionAccess {
  return Object.freeze({
    status: "unauthenticated" as const,
    reason: resolution.reason,
  });
}

/** Maps the future authoritative guard result to customer API semantics. */
export function getCustomerApiSessionAccess(
  resolution: AuthoritativeSessionResolution,
): CustomerApiSessionAccess {
  if (resolution.status === "authenticated") {
    return Object.freeze({
      status: "ok" as const,
      principal: resolution.principal,
    });
  }
  if (resolution.status === "anonymous") return mapAnonymous(resolution);
  return Object.freeze({ status: "unavailable" as const });
}

function mapAdminAccess(
  resolution: AuthoritativeSessionResolution,
  decision: ReturnType<typeof getAdminApiAccess>,
): AdminSessionAccess {
  if (resolution.status === "anonymous") {
    return Object.freeze({
      status: "unauthenticated" as const,
      reason: resolution.reason,
    });
  }
  if (resolution.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const });
  }

  if (decision.allowed) {
    return Object.freeze({
      status: "ok" as const,
      principal: resolution.principal,
      role: decision.role,
    });
  }

  // This branch is reachable only for an authenticated principal, so the
  // legacy policy's anonymous denial cannot be exposed here.
  if (decision.reason === "UNAUTHENTICATED") {
    return Object.freeze({
      status: "forbidden" as const,
      reason: "NOT_ADMIN_STAFF" as const,
    });
  }
  return Object.freeze({
    status: "forbidden" as const,
    reason: decision.reason,
  });
}

/**
 * Applies the existing, centralized admin API allowlist to a fresh DB
 * principal. Anonymous and unavailable outcomes deliberately bypass role
 * policy evaluation so a database outage can never become a 401/403.
 */
export function getAdminApiSessionAccess(
  resolution: AuthoritativeSessionResolution,
  pathname: string,
  method: string,
): AdminSessionAccess {
  if (resolution.status !== "authenticated") {
    return mapAdminAccess(resolution, {
      allowed: false,
      reason: "UNAUTHENTICATED",
    });
  }
  return mapAdminAccess(
    resolution,
    getAdminApiAccess(resolution.principal.role, pathname, method),
  );
}

/** Applies the existing, centralized admin page allowlist to a fresh DB principal. */
export function getAdminPageSessionAccess(
  resolution: AuthoritativeSessionResolution,
  pathname: string,
): AdminSessionAccess {
  if (resolution.status !== "authenticated") {
    return mapAdminAccess(resolution, {
      allowed: false,
      reason: "UNAUTHENTICATED",
    });
  }
  return mapAdminAccess(
    resolution,
    getAdminPageAccess(resolution.principal.role, pathname),
  );
}
