import { AUTH_SESSION_COOKIE_BASE_NAMES } from "./config";

export const MAX_AUTH_SESSION_COOKIE_CHUNKS = 8;
export const MAX_AUTH_SESSION_COOKIE_CHUNK_LENGTH = 4_096;
export const MAX_AUTH_SESSION_COOKIE_TOTAL_LENGTH = 32_768;

export interface AuthSessionRequestCookie {
  name: unknown;
  value: unknown;
}

export type AuthSessionCookieReadResult =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "present"; token: string }>;

const MISSING_RESULT: AuthSessionCookieReadResult = Object.freeze({
  status: "missing" as const,
});
const INVALID_RESULT: AuthSessionCookieReadResult = Object.freeze({
  status: "invalid" as const,
});

function presentResult(token: string): AuthSessionCookieReadResult {
  return Object.freeze({ status: "present" as const, token });
}

function isActiveV2BaseName(value: unknown): value is string {
  // Retain a runtime check: future config changes must not make a legacy
  // cookie readable just because a caller supplies its name.
  return (
    typeof value === "string" &&
    (value === AUTH_SESSION_COOKIE_BASE_NAMES[0] ||
      value === AUTH_SESSION_COOKIE_BASE_NAMES[1])
  );
}

function isUsableChunkValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_AUTH_SESSION_COOKIE_CHUNK_LENGTH
  );
}

/**
 * Reads one exact V2 session cookie without NextAuth's permissive prefix-based
 * reader. The caller supplies the active secure or insecure V2 base; legacy
 * and unrelated cookies are never a source of a token.
 */
export function readAuthSessionCookie(
  requestCookies: unknown,
  activeBaseName: unknown,
): AuthSessionCookieReadResult {
  if (!isActiveV2BaseName(activeBaseName)) return INVALID_RESULT;
  if (requestCookies === null || requestCookies === undefined) {
    return MISSING_RESULT;
  }
  try {
    if (!Array.isArray(requestCookies)) return INVALID_RESULT;
  } catch {
    return INVALID_RESULT;
  }

  let baseValue: string | undefined;
  const chunks = new Map<number, string>();
  const chunkPrefix = `${activeBaseName}.`;

  try {
    for (const candidate of requestCookies) {
      if (
        candidate === null ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        continue;
      }

      const { name, value } = candidate as AuthSessionRequestCookie;
      if (name === activeBaseName) {
        if (baseValue !== undefined || !isUsableChunkValue(value)) {
          return INVALID_RESULT;
        }
        baseValue = value;
        continue;
      }
      if (typeof name !== "string" || !name.startsWith(chunkPrefix)) continue;

      const suffix = name.slice(chunkPrefix.length);
      // A single ASCII digit is canonical decimal and bounds the index without
      // coercing a hostilely large suffix to a JavaScript number.
      if (!/^[0-7]$/.test(suffix) || !isUsableChunkValue(value)) {
        return INVALID_RESULT;
      }
      const index = suffix.charCodeAt(0) - "0".charCodeAt(0);
      if (chunks.has(index)) return INVALID_RESULT;
      chunks.set(index, value);
    }
  } catch {
    return INVALID_RESULT;
  }

  if (baseValue !== undefined && chunks.size > 0) return INVALID_RESULT;
  if (baseValue !== undefined) return presentResult(baseValue);
  if (chunks.size === 0) return MISSING_RESULT;
  if (chunks.size > MAX_AUTH_SESSION_COOKIE_CHUNKS) return INVALID_RESULT;

  let token = "";
  for (let index = 0; index < chunks.size; index += 1) {
    const chunk = chunks.get(index);
    if (chunk === undefined) return INVALID_RESULT;
    if (token.length + chunk.length > MAX_AUTH_SESSION_COOKIE_TOTAL_LENGTH) {
      return INVALID_RESULT;
    }
    token += chunk;
  }
  return token.length > 0 ? presentResult(token) : INVALID_RESULT;
}
