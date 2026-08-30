import { AUTH_SESSION_MAX_AGE_SECONDS } from "./config";

/**
 * Edge-safe half of the V2 session-claim contract.
 *
 * This module intentionally has no Node built-in imports and does not use
 * Buffer. It is the only claim module that may be imported by Proxy/Edge
 * authentication code. SID generation and HMAC storage-key derivation stay
 * in `session-claims.ts`, which is Node-only.
 */
export const AUTH_SESSION_CLAIMS_VERSION = 2;
export const AUTH_SESSION_SID_BYTES = 32;
export const AUTH_SESSION_SID_LENGTH = 43;
export const AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS =
  AUTH_SESSION_MAX_AGE_SECONDS;

const AUTH_SESSION_SID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// A 32-byte base64url encoding has one unpadded final character with four
// significant bits. Its two discarded pad bits must be zero, so its index is
// a multiple of four.
const CANONICAL_32_BYTE_BASE64URL_FINAL_CHARACTER_PATTERN = /[AEIMQUYcgkosw048]$/;
const MAX_AUTH_SESSION_SUBJECT_UTF8_BYTES = 191;
const MAX_JAVASCRIPT_DATE_EPOCH_SECONDS = 8_640_000_000_000;

export interface AuthSessionClaimsV2 {
  sv: 2;
  sub: string;
  sid: string;
  ur: number;
  pr: number;
  sat: number;
  sae: number;
}

export interface CreateAuthSessionClaimsV2Input {
  sub: string;
  sid: unknown;
  ur: number;
  pr: number;
  issuedAt: Date;
  absoluteExpiresAt: Date;
}

export class AuthSessionClaimsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthSessionClaimsError";
  }
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isSecondAlignedDate(value: unknown): value is Date {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getMilliseconds() === 0
  );
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function assertAuthSessionClaimsV2(
  claims: AuthSessionClaimsV2,
): AuthSessionClaimsV2 {
  if (
    claims.sv !== AUTH_SESSION_CLAIMS_VERSION ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0 ||
    claims.sub.trim() !== claims.sub ||
    utf8ByteLength(claims.sub) > MAX_AUTH_SESSION_SUBJECT_UTF8_BYTES ||
    /[\u0000-\u001f\u007f]/.test(claims.sub) ||
    normalizeAuthSessionSid(claims.sid) !== claims.sid ||
    !isSafeInteger(claims.ur) ||
    claims.ur < 0 ||
    !isSafeInteger(claims.pr) ||
    claims.pr < 1 ||
    !isSafeInteger(claims.sat) ||
    claims.sat < 0 ||
    claims.sat > MAX_JAVASCRIPT_DATE_EPOCH_SECONDS ||
    !isSafeInteger(claims.sae) ||
    claims.sae > MAX_JAVASCRIPT_DATE_EPOCH_SECONDS ||
    claims.sae <= claims.sat ||
    claims.sae - claims.sat > AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS
  ) {
    throw new AuthSessionClaimsError("V2 session claims nisu validni");
  }

  return claims;
}

/**
 * Accepts only the canonical, unpadded textual form of a 32-byte SID.
 * The length/alphabet establish a base64url encoding and the final character
 * check rejects non-zero discarded pad bits without relying on Node Buffer.
 */
export function normalizeAuthSessionSid(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !AUTH_SESSION_SID_PATTERN.test(value) ||
    !CANONICAL_32_BYTE_BASE64URL_FINAL_CHARACTER_PATTERN.test(value)
  ) {
    return null;
  }

  return value;
}

/**
 * Parses only an exact V2 claim shape. Unknown keys are rejected so adding a
 * claim cannot silently create a mixed-format authorization token.
 */
export function parseAuthSessionClaimsV2(
  value: unknown,
): Readonly<AuthSessionClaimsV2> | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = ["pr", "sae", "sat", "sid", "sub", "sv", "ur"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    return null;
  }

  try {
    const claims = assertAuthSessionClaimsV2({
      sv: record.sv as 2,
      sub: record.sub as string,
      sid: record.sid as string,
      ur: record.ur as number,
      pr: record.pr as number,
      sat: record.sat as number,
      sae: record.sae as number,
    });

    return Object.freeze({ ...claims });
  } catch {
    return null;
  }
}

/**
 * Creates immutable V2 claims from whole-second Date values. Callers must
 * supply the original absolute expiry; this helper never rolls it forward.
 */
export function createAuthSessionClaimsV2(
  input: CreateAuthSessionClaimsV2Input,
): Readonly<AuthSessionClaimsV2> {
  if (!isSecondAlignedDate(input.issuedAt) || !isSecondAlignedDate(input.absoluteExpiresAt)) {
    throw new AuthSessionClaimsError(
      "Session issuedAt i absoluteExpiresAt moraju biti validni celi sekundi",
    );
  }

  const claims = assertAuthSessionClaimsV2({
    sv: AUTH_SESSION_CLAIMS_VERSION,
    sub: input.sub,
    sid: input.sid as string,
    ur: input.ur,
    pr: input.pr,
    sat: input.issuedAt.getTime() / 1_000,
    sae: input.absoluteExpiresAt.getTime() / 1_000,
  });

  return Object.freeze({ ...claims });
}

/** Exact boundary semantics: a session is expired when now >= sae. */
export function isAuthSessionClaimsExpired(
  claims: AuthSessionClaimsV2,
  nowEpochSeconds: unknown,
): boolean {
  assertAuthSessionClaimsV2(claims);
  if (!isSafeInteger(nowEpochSeconds) || nowEpochSeconds < 0) {
    throw new AuthSessionClaimsError("Session vreme mora biti bezbedan epoch sekund");
  }

  return nowEpochSeconds >= claims.sae;
}
