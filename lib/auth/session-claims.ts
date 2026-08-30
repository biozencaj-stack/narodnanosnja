import { createHmac, randomBytes } from "node:crypto";
import {
  AUTH_SESSION_SID_BYTES,
  AuthSessionClaimsError,
  createAuthSessionClaimsV2 as createEdgeAuthSessionClaimsV2,
  normalizeAuthSessionSid,
} from "./session-claims-edge";

/**
 * Node-only SID generation and HMAC storage-key facade.
 *
 * Proxy/Edge code must import parser, expiry and claim creation directly from
 * `session-claims-edge.ts`; it must never import this module.
 */
export {
  AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS,
  AUTH_SESSION_CLAIMS_VERSION,
  AUTH_SESSION_SID_BYTES,
  AUTH_SESSION_SID_LENGTH,
  AuthSessionClaimsError,
  isAuthSessionClaimsExpired,
  normalizeAuthSessionSid,
  parseAuthSessionClaimsV2,
} from "./session-claims-edge";
export type {
  AuthSessionClaimsV2,
} from "./session-claims-edge";

export const AUTH_SESSION_STORAGE_KEY_VERSION = "v1";

const AUTH_SESSION_STORAGE_KEY_PATTERN = /^v1:[0-9a-f]{64}$/;
const AUTH_SESSION_HMAC_DOMAIN = "narodna-nosnja:auth-session-storage:v1";
const MIN_SESSION_HMAC_SECRET_BYTES = 32;

export type AuthSessionStorageKey = `v1:${string}`;

export interface CreateAuthSessionClaimsV2Input {
  sub: string;
  sid?: unknown;
  ur: number;
  pr: number;
  issuedAt: Date;
  absoluteExpiresAt: Date;
}

export function assertAuthSessionStorageSecret(
  secret: unknown,
): asserts secret is string {
  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < MIN_SESSION_HMAC_SECRET_BYTES
  ) {
    throw new AuthSessionClaimsError(
      "Session HMAC secret mora imati najmanje 32 UTF-8 bajta",
    );
  }
}

/** Creates a canonical, unpadded 256-bit session identifier for a JWT claim. */
export function generateAuthSessionSid(): string {
  return randomBytes(AUTH_SESSION_SID_BYTES).toString("base64url");
}

/**
 * Node convenience facade that supplies a fresh SID when the caller does not
 * already have one. Edge code must supply a SID explicitly and import the
 * edge-safe primitive instead.
 */
export function createAuthSessionClaimsV2(
  input: CreateAuthSessionClaimsV2Input,
) {
  return createEdgeAuthSessionClaimsV2({
    ...input,
    sid: input.sid === undefined ? generateAuthSessionSid() : input.sid,
  });
}

/** Recognizes only the canonical indexed representation stored in Session. */
export function isAuthSessionStorageKey(
  value: unknown,
): value is AuthSessionStorageKey {
  return typeof value === "string" && AUTH_SESSION_STORAGE_KEY_PATTERN.test(value);
}

/**
 * Derives a versioned lookup key. The raw SID remains confined to the JWT;
 * this function never returns it or a reversible representation of it.
 */
export function createAuthSessionStorageKey(
  secret: unknown,
  sid: unknown,
): AuthSessionStorageKey | null {
  assertAuthSessionStorageSecret(secret);

  const canonicalSid = normalizeAuthSessionSid(sid);
  if (!canonicalSid) return null;

  const digest = createHmac("sha256", secret)
    .update(`${AUTH_SESSION_HMAC_DOMAIN}\0${canonicalSid}`, "utf8")
    .digest("hex");

  return `${AUTH_SESSION_STORAGE_KEY_VERSION}:${digest}`;
}
