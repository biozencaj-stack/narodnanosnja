import {
  AUTH_SESSION_COOKIE_BASE_NAMES,
  MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX,
} from "./config";

export {
  AUTH_SESSION_COOKIE_BASE_NAMES,
  MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX,
} from "./config";

/** Four known bases plus a bounded batch of recognized cookie chunks. */
export const MAX_AUTH_SESSION_COOKIE_CLEANUPS = 32;

export interface AuthSessionCookieName {
  name: unknown;
}

export interface AuthSessionCookieCleanupDescriptor {
  name: string;
  value: "";
  path: "/";
  httpOnly: true;
  sameSite: "lax";
  maxAge: 0;
  expires: Date;
  secure: boolean;
}

export interface AuthSessionCookieCleanupPlan {
  cookies: ReadonlyArray<AuthSessionCookieCleanupDescriptor>;
  /**
   * True when this response deliberately leaves recognized chunks for a later
   * request. Repeated logout requests then remove the next deterministic batch
   * without ever amplifying Set-Cookie headers beyond the hard limit.
   */
  hasRemainingRecognizedChunks: boolean;
}

function isCanonicalChunkSuffix(value: string): boolean {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) return false;
  // NextAuth/browser cookie limits make a three-digit chunk index far beyond
  // realistic use. Bounding it also prevents an oversized hostile suffix from
  // ever becoming a reflected Set-Cookie name.
  return (
    value.length <= String(MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX).length &&
    Number(value) <= MAX_AUTH_SESSION_COOKIE_CHUNK_INDEX
  );
}

function baseNameForChunk(name: string): string | null {
  for (const baseName of AUTH_SESSION_COOKIE_BASE_NAMES) {
    const prefix = `${baseName}.`;
    if (!name.startsWith(prefix)) continue;
    return isCanonicalChunkSuffix(name.slice(prefix.length)) ? baseName : null;
  }
  return null;
}

function compareChunkNames(left: string, right: string): number {
  const leftBase = baseNameForChunk(left);
  const rightBase = baseNameForChunk(right);
  if (!leftBase || !rightBase) return left < right ? -1 : left > right ? 1 : 0;

  const leftBaseIndex = AUTH_SESSION_COOKIE_BASE_NAMES.indexOf(
    leftBase as (typeof AUTH_SESSION_COOKIE_BASE_NAMES)[number],
  );
  const rightBaseIndex = AUTH_SESSION_COOKIE_BASE_NAMES.indexOf(
    rightBase as (typeof AUTH_SESSION_COOKIE_BASE_NAMES)[number],
  );
  if (leftBaseIndex !== rightBaseIndex) return leftBaseIndex - rightBaseIndex;

  const leftSuffix = left.slice(leftBase.length + 1);
  const rightSuffix = right.slice(rightBase.length + 1);
  // Canonical decimal suffixes permit an exact numeric ordering without
  // coercing a hostilely large suffix into a JavaScript number.
  if (leftSuffix.length !== rightSuffix.length) {
    return leftSuffix.length - rightSuffix.length;
  }
  return leftSuffix < rightSuffix ? -1 : leftSuffix > rightSuffix ? 1 : 0;
}

function cleanupDescriptor(name: string): AuthSessionCookieCleanupDescriptor {
  return Object.freeze({
    name,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    secure: name.startsWith("__Secure-"),
  });
}

function selectChunkBatch(
  requestCookies: readonly AuthSessionCookieName[] | null | undefined,
): { chunks: ReadonlySet<string>; hasRemainingRecognizedChunks: boolean } {
  const capacity =
    MAX_AUTH_SESSION_COOKIE_CLEANUPS - AUTH_SESSION_COOKIE_BASE_NAMES.length;
  const selected = new Set<string>();
  let hasRemainingRecognizedChunks = false;

  if (!Array.isArray(requestCookies)) {
    return { chunks: selected, hasRemainingRecognizedChunks };
  }

  for (const cookie of requestCookies) {
    if (!cookie || typeof cookie.name !== "string") continue;
    if (!baseNameForChunk(cookie.name) || selected.has(cookie.name)) continue;

    if (selected.size < capacity) {
      selected.add(cookie.name);
      continue;
    }

    let largest: string | undefined;
    for (const selectedName of selected) {
      if (!largest || compareChunkNames(selectedName, largest) > 0) {
        largest = selectedName;
      }
    }
    if (!largest) continue;

    hasRemainingRecognizedChunks = true;
    if (compareChunkNames(cookie.name, largest) < 0) {
      selected.delete(largest);
      selected.add(cookie.name);
    }
  }

  return { chunks: selected, hasRemainingRecognizedChunks };
}

/**
 * Produces a deterministic, progressive cleanup plan for legacy and V2 auth
 * cookies. Every known base is included even if absent from the request, while
 * chunk names are exact request-derived matches only. This never reflects an
 * arbitrary cookie name into Set-Cookie.
 */
export function createAuthSessionCookieCleanupPlan(
  requestCookies: readonly AuthSessionCookieName[] | null | undefined,
): AuthSessionCookieCleanupPlan {
  const { chunks, hasRemainingRecognizedChunks } =
    selectChunkBatch(requestCookies);
  const names: string[] = [];

  for (const baseName of AUTH_SESSION_COOKIE_BASE_NAMES) {
    names.push(baseName);
    const baseChunks = [...chunks]
      .filter((name) => baseNameForChunk(name) === baseName)
      .sort(compareChunkNames);
    names.push(...baseChunks);
  }

  return Object.freeze({
    cookies: Object.freeze(names.map(cleanupDescriptor)),
    hasRemainingRecognizedChunks,
  });
}

/** Compatibility shorthand for callers that only need this response batch. */
export function createAuthSessionCookieCleanup(
  requestCookies: readonly AuthSessionCookieName[] | null | undefined,
): ReadonlyArray<AuthSessionCookieCleanupDescriptor> {
  return createAuthSessionCookieCleanupPlan(requestCookies).cookies;
}
