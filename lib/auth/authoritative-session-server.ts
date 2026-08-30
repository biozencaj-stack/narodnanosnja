import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createAuthoritativeSessionDatabase } from "./authoritative-session-database";
import {
  createAuthoritativeSessionGuard,
  type AuthoritativeSessionGuardReport,
  type AuthoritativeSessionResolution,
} from "./authoritative-session-guard";
import {
  authSessionV2CookieName,
  resolveAuthSecret,
} from "./config";
import { decodeAuthSessionJwt } from "./session-jwt";

const SERVER_SESSION_UNAVAILABLE = Object.freeze({
  status: "unavailable" as const,
});

type ProductionGuard = ReturnType<typeof createAuthoritativeSessionGuard>;

let productionGuard: ProductionGuard | null = null;

function reportGuardFailure(event: AuthoritativeSessionGuardReport): void {
  // This contract cannot carry a cookie, token, claim, principal, SID,
  // database row or raw exception.
  try {
    console.error("Authoritative session guard unavailable", event);
  } catch {
    // Observability must never replace the fail-closed request result.
  }
}

function getProductionGuard(): ProductionGuard {
  if (productionGuard) return productionGuard;

  // Resolve one secret once and share it between JWE decoding and HMAC-backed
  // storage lookup. A deployment configuration failure is caught by the
  // public resolver and becomes fail-closed `unavailable`, never anonymous.
  const secret = resolveAuthSecret();
  const authoritative = createAuthoritativeSessionDatabase(prisma, secret);
  productionGuard = createAuthoritativeSessionGuard({
    secret,
    activeCookieName: authSessionV2CookieName(),
    decode: decodeAuthSessionJwt,
    validate: authoritative.validate,
    report: reportGuardFailure,
  });
  return productionGuard;
}

/**
 * Resolves the current request from the strict V2 cookie only.
 *
 * This module deliberately does not use NextAuth `getToken`,
 * `getServerSession`, an Authorization header, the legacy cookie, or a JWT
 * profile fallback. It remains dormant until every server enforcement
 * callsite is migrated in the reviewed activation cutover.
 */
export async function resolveAuthoritativeServerSession(): Promise<
  AuthoritativeSessionResolution
> {
  try {
    const requestCookies = (await cookies()).getAll();
    return await getProductionGuard().resolve(requestCookies);
  } catch {
    reportGuardFailure({ stage: "REQUEST_CONTEXT" });
    return SERVER_SESSION_UNAVAILABLE;
  }
}
