import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_BEARER_SECRET_LENGTH = 32;

const BEARER_PREFIX = "Bearer ";
const BEARER_TOKEN_CHARACTER = /^[A-Za-z0-9._~+/-]$/;

function isBearerToken(value: string): boolean {
  let payloadLength = 0;
  let reachedPadding = false;

  for (const character of value) {
    if (character === "=") {
      reachedPadding = true;
      continue;
    }
    if (reachedPadding || !BEARER_TOKEN_CHARACTER.test(character)) {
      return false;
    }
    payloadLength += 1;
  }

  return payloadLength > 0;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Validates one exact `Authorization: Bearer <secret>` value. Both digests
 * have a fixed length, so validly shaped wrong tokens are compared without a
 * secret-dependent early exit. Configuration and header parsing fail closed.
 */
export function isValidBearerAuthorization(
  authorizationHeader: string | null | undefined,
  configuredSecret: string | null | undefined,
): boolean {
  if (
    typeof configuredSecret !== "string" ||
    configuredSecret.length < MIN_BEARER_SECRET_LENGTH ||
    !isBearerToken(configuredSecret) ||
    typeof authorizationHeader !== "string" ||
    !authorizationHeader.startsWith(BEARER_PREFIX)
  ) {
    return false;
  }

  const suppliedToken = authorizationHeader.slice(BEARER_PREFIX.length);
  if (!isBearerToken(suppliedToken)) return false;

  const suppliedDigest = digest(authorizationHeader);
  const expectedDigest = digest(`${BEARER_PREFIX}${configuredSecret}`);
  return timingSafeEqual(suppliedDigest, expectedDigest);
}
