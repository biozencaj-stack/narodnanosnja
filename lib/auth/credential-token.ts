import { createHash, randomBytes } from "node:crypto";

const RAW_CREDENTIAL_TOKEN_BYTES = 32;
const RAW_CREDENTIAL_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const CURRENT_HASH_PATTERN = /^v1:[0-9a-f]{64}$/;
const HASH_DOMAIN = "narodna-nosnja:credential-token:v1";

export type CredentialTokenPurpose =
  | "email-verification"
  | "password-reset";

export type CurrentCredentialTokenHash = `v1:${string}`;

export interface CredentialTokenLookupKeys {
  /** Canonical raw value used only at the browser/email boundary. */
  normalizedRawToken: string;
  /** Preferred value for lookup in the current tokenHash column. */
  currentHash: CurrentCredentialTokenHash;
  /** Temporary fallback for rows written to the legacy plaintext column. */
  legacyPlaintext: string;
}

/** Generates a 256-bit bearer credential encoded as 64 lowercase hex chars. */
export function generateRawCredentialToken(): string {
  return randomBytes(RAW_CREDENTIAL_TOKEN_BYTES).toString("hex");
}

/**
 * Parses the public credential representation without trimming or coercion.
 * Invalid input returns null so callers never need to include it in an error.
 */
export function normalizeRawCredentialToken(value: unknown): string | null {
  if (typeof value !== "string" || !RAW_CREDENTIAL_TOKEN_PATTERN.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

/** Recognizes only the current, canonical lowercase storage representation. */
export function isCurrentCredentialTokenHash(
  value: unknown,
): value is CurrentCredentialTokenHash {
  return typeof value === "string" && CURRENT_HASH_PATTERN.test(value);
}

/**
 * Produces an indexed, versioned SHA-256 lookup value. Domain separation keeps
 * an identical raw credential distinct across verification and reset flows.
 */
export function hashCredentialToken(
  purpose: CredentialTokenPurpose,
  value: unknown,
): CurrentCredentialTokenHash | null {
  if (purpose !== "email-verification" && purpose !== "password-reset") {
    return null;
  }

  const normalizedRawToken = normalizeRawCredentialToken(value);
  if (!normalizedRawToken) return null;

  const digest = createHash("sha256")
    .update(`${HASH_DOMAIN}\0${purpose}\0${normalizedRawToken}`, "utf8")
    .digest("hex");

  return `v1:${digest}`;
}

/**
 * Returns explicitly ordered migration keys: query currentHash first and use
 * legacyPlaintext only while the compatibility window remains enabled.
 */
export function createCredentialTokenLookupKeys(
  purpose: CredentialTokenPurpose,
  value: unknown,
): CredentialTokenLookupKeys | null {
  const normalizedRawToken = normalizeRawCredentialToken(value);
  if (!normalizedRawToken) return null;

  const currentHash = hashCredentialToken(purpose, normalizedRawToken);
  if (!currentHash) return null;

  return {
    normalizedRawToken,
    currentHash,
    legacyPlaintext: normalizedRawToken,
  };
}
