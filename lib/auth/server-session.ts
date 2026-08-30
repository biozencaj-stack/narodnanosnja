import "server-only";

import { getServerSession } from "next-auth";
import {
  createLegacyServerSessionResolver,
  type LegacyServerSessionReport,
} from "./legacy-server-session";
import type { ServerSessionResolution } from "./server-session-contract";

function reportLegacySessionFailure(event: LegacyServerSessionReport): void {
  // The event is deliberately coarse and cannot contain a token, user,
  // cookie, request, raw session or exception.
  try {
    console.error("Transitional server session unavailable", event);
  } catch {
    // Observability must never replace the fail-closed request result.
  }
}

// LEGACY_TRANSITIONAL_IMPLEMENTATION: this is the only implementation before
// the atomic V2 cutover. Never add V2 probing or legacy fallback to this file.
const resolver = createLegacyServerSessionResolver({
  async read() {
    // authOptions validates policy, URL and secret while its module loads.
    // Keep that work inside the adapter's protected read boundary so a
    // configuration/import failure becomes `unavailable`, not an uncaught
    // module-evaluation failure.
    const { authOptions } = await import("./index");
    return getServerSession(authOptions);
  },
  report: reportLegacySessionFailure,
});

/**
 * Resolves the current server request through exactly one credential source.
 * Callers must handle authenticated, anonymous and unavailable separately.
 */
export async function resolveServerSession(): Promise<ServerSessionResolution> {
  return resolver.resolve();
}

export type {
  ServerSessionPrincipal,
  ServerSessionResolution,
} from "./server-session-contract";
