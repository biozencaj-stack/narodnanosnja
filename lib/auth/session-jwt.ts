import {
  decode as defaultNextAuthJwtDecode,
  encode as defaultNextAuthJwtEncode,
  type JWT,
  type JWTDecodeParams,
  type JWTEncodeParams,
} from "next-auth/jwt";
import {
  AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS,
  isAuthSessionClaimsExpired,
  parseAuthSessionClaimsV2,
  type AuthSessionClaimsV2,
} from "./session-claims-edge";

type JwtEncoder = (params: JWTEncodeParams) => Promise<string>;
type JwtDecoder = (params: JWTDecodeParams) => Promise<JWT | null>;

export interface AuthSessionJwtCodecDependencies {
  encode?: JwtEncoder;
  decode?: JwtDecoder;
  nowEpochSeconds?: () => number;
}

export class AuthSessionJwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthSessionJwtError";
  }
}

function defaultNowEpochSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

function readWholeEpochSecond(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new AuthSessionJwtError("Session JWT vreme nije validno");
  }
  return value;
}

/**
 * NextAuth adds standard JWE/JWT fields and the jwt callback may temporarily
 * attach a fresh principal for the session callback. Only the seven reviewed
 * security claims are ever copied into the encrypted session token.
 */
export function extractAuthSessionClaimsV2(
  value: unknown,
): Readonly<AuthSessionClaimsV2> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const token = value as Record<string, unknown>;
  return parseAuthSessionClaimsV2({
    sv: token.sv,
    sub: token.sub,
    sid: token.sid,
    ur: token.ur,
    pr: token.pr,
    sat: token.sat,
    sae: token.sae,
  });
}

/**
 * Builds a NextAuth-compatible codec with an immutable absolute session end.
 * The outer JWE may be refreshed, but every refresh contains the original sae
 * and receives at most its remaining lifetime.
 */
export function createAuthSessionJwtCodec(
  dependencies: AuthSessionJwtCodecDependencies = {},
): {
  encode: JwtEncoder;
  decode: JwtDecoder;
} {
  const encodeJwt = dependencies.encode ?? defaultNextAuthJwtEncode;
  const decodeJwt = dependencies.decode ?? defaultNextAuthJwtDecode;
  const nowEpochSeconds =
    dependencies.nowEpochSeconds ?? defaultNowEpochSeconds;

  return {
    async encode(params): Promise<string> {
      const claims = extractAuthSessionClaimsV2(params.token);
      if (!claims) {
        throw new AuthSessionJwtError("Session JWT nema validne V2 claims");
      }

      const now = readWholeEpochSecond(nowEpochSeconds());
      if (isAuthSessionClaimsExpired(claims, now)) {
        throw new AuthSessionJwtError("Session JWT je istekao");
      }

      const configuredMaxAge =
        params.maxAge ?? AUTH_SESSION_ABSOLUTE_MAX_AGE_SECONDS;
      if (
        !Number.isSafeInteger(configuredMaxAge) ||
        configuredMaxAge < 1
      ) {
        throw new AuthSessionJwtError("Session JWT maxAge nije validan");
      }

      const remainingLifetime = claims.sae - now;
      const boundedMaxAge = Math.min(configuredMaxAge, remainingLifetime);

      return encodeJwt({
        ...params,
        token: { ...claims } as unknown as JWT,
        maxAge: boundedMaxAge,
      });
    },

    async decode(params): Promise<JWT | null> {
      let decoded: JWT | null;
      try {
        decoded = await decodeJwt(params);
      } catch {
        return null;
      }

      const claims = extractAuthSessionClaimsV2(decoded);
      if (!claims) return null;

      let now: number;
      try {
        now = readWholeEpochSecond(nowEpochSeconds());
      } catch {
        return null;
      }
      const encryptedExpiresAt = decoded?.exp;
      if (
        typeof encryptedExpiresAt !== "number" ||
        !Number.isSafeInteger(encryptedExpiresAt) ||
        encryptedExpiresAt < 1 ||
        now >= encryptedExpiresAt ||
        isAuthSessionClaimsExpired(claims, now)
      ) {
        return null;
      }

      return { ...claims } as unknown as JWT;
    },
  };
}

const defaultAuthSessionJwtCodec = createAuthSessionJwtCodec();

export const encodeAuthSessionJwt = defaultAuthSessionJwtCodec.encode;
export const decodeAuthSessionJwt = defaultAuthSessionJwtCodec.decode;
