import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "../security/bounded-json";
import { isTrustedWriteRequest } from "../security/origin";
import {
  PasswordResetConfirmConflictError,
  type PasswordResetConfirmClaim,
} from "./password-reset-confirm";
import { isBcryptSafePassword } from "./password";

export const PASSWORD_RESET_CONFIRM_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
export { MAX_BCRYPT_PASSWORD_BYTES } from "./password";
export const MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES = 1024;

export const PASSWORD_RESET_CONFIRM_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export const PASSWORD_RESET_CONFIRM_INVALID_MESSAGE =
  "Neispravan ili istekao link za reset lozinke";
export const PASSWORD_RESET_CONFIRM_RETRY_MESSAGE =
  "Promena lozinke trenutno nije dostupna. Pokušajte ponovo.";
export const PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE =
  "Lozinka je uspešno promenjena. Možete se prijaviti.";

export type PasswordResetConfirmFailureStage =
  | "RATE_LIMIT"
  | "PASSWORD_VALIDATION"
  | "TOKEN_KEYS"
  | "HASH_LOOKUP"
  | "LEGACY_LOOKUP"
  | "EXPIRY_CHECK"
  | "PASSWORD_HASH"
  | "RESPONSE_PREPARATION"
  | "COMMIT";

export interface PasswordResetConfirmFailure {
  stage: PasswordResetConfirmFailureStage;
}

export interface PasswordResetConfirmLookupKeys {
  normalizedRawToken: string;
  currentHash: string;
  legacyPlaintext: string;
}

export interface PasswordResetConfirmRecord {
  id: string;
  userId: string;
  expires: Date;
  token: string | null;
  tokenHash: string | null;
}

interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export interface PasswordResetConfirmHandlerDependencies {
  checkRateLimit: (key: string, limit: number) => boolean;
  validatePassword: (password: string) => PasswordValidation;
  createLookupKeys: (
    submittedToken: string,
  ) => PasswordResetConfirmLookupKeys | null;
  findByCurrentHash: (
    currentHash: string,
  ) => Promise<PasswordResetConfirmRecord | null>;
  findByLegacyToken: (
    legacyPlaintext: string,
  ) => Promise<PasswordResetConfirmRecord | null>;
  hashPassword: (password: string) => Promise<string>;
  prepareSuccessResponse: () => NextResponse | Promise<NextResponse>;
  commitReset: (
    claim: PasswordResetConfirmClaim,
    passwordHash: string,
  ) => Promise<void>;
  reportFailure: (failure: PasswordResetConfirmFailure) => void;
}

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: PASSWORD_RESET_CONFIRM_PRIVATE_HEADERS,
  });
}

export function applyPasswordResetConfirmPrivateHeaders<
  TResponse extends NextResponse,
>(response: TResponse): TResponse {
  for (const [name, value] of Object.entries(
    PASSWORD_RESET_CONFIRM_PRIVATE_HEADERS,
  )) {
    response.headers.set(name, value);
  }
  return response;
}

function invalidCredentialResponse(): NextResponse {
  return jsonResponse(
    { error: PASSWORD_RESET_CONFIRM_INVALID_MESSAGE },
    400,
  );
}

function retryResponse(): NextResponse {
  return jsonResponse({ error: PASSWORD_RESET_CONFIRM_RETRY_MESSAGE }, 503);
}

function safelyReportFailure(
  reportFailure: PasswordResetConfirmHandlerDependencies["reportFailure"],
  stage: PasswordResetConfirmFailureStage,
): void {
  try {
    reportFailure({ stage });
  } catch {
    // Observability must never replace the generic public response.
  }
}

function exactPasswordResetConfirmBody(
  body: unknown,
): { token: unknown; password: unknown } | null {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    return null;
  }

  const keys = Object.keys(body);
  if (
    keys.length !== 2 ||
    !Object.prototype.hasOwnProperty.call(body, "token") ||
    !Object.prototype.hasOwnProperty.call(body, "password") ||
    keys.some((key) => key !== "token" && key !== "password")
  ) {
    return null;
  }

  return body as { token: unknown; password: unknown };
}

function recordClaim(
  record: PasswordResetConfirmRecord,
  keys: PasswordResetConfirmLookupKeys,
  lookupKind: "current-hash" | "legacy-plaintext",
): PasswordResetConfirmClaim {
  if (lookupKind === "current-hash") {
    if (record.tokenHash !== keys.currentHash) {
      throw new Error("Current credential lookup returned a mismatched row");
    }
    return {
      id: record.id,
      userId: record.userId,
      credential: {
        kind: "current-hash",
        storedValue: record.tokenHash,
      },
    };
  }

  if (
    record.tokenHash !== null ||
    record.token !== keys.legacyPlaintext
  ) {
    throw new Error("Legacy credential lookup returned a mismatched row");
  }
  return {
    id: record.id,
    userId: record.userId,
    credential: {
      kind: "legacy-plaintext",
      storedValue: record.token,
    },
  };
}

export function createPasswordResetConfirmHandler(
  dependencies: PasswordResetConfirmHandlerDependencies,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    // /api/auth is globally exempt for NextAuth callbacks. This endpoint must
    // therefore enforce same-origin before body parsing, configuration or DB.
    if (!isTrustedWriteRequest(request.headers)) {
      return jsonResponse(
        { error: "Zahtev za promenu lozinke nije dozvoljen." },
        403,
      );
    }

    let stage: PasswordResetConfirmFailureStage = "RATE_LIMIT";

    try {
      const ip = request.headers.get("x-forwarded-for") || "unknown";
      if (!dependencies.checkRateLimit(`reset-confirm:${ip}`, 5)) {
        return jsonResponse(
          { error: "Previše pokušaja. Pokušajte ponovo za minut." },
          429,
        );
      }

      const bodyResult = await readBoundedJson(
        request,
        MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES,
      );
      if (!bodyResult.ok) {
        const error =
          bodyResult.status === 413
            ? "Zahtev je prevelik."
            : bodyResult.status === 415
              ? "Nepodržan format zahteva."
              : "Neispravan zahtev";
        return jsonResponse({ error }, bodyResult.status);
      }

      const body = exactPasswordResetConfirmBody(bodyResult.value);
      if (!body) {
        return jsonResponse({ error: "Neispravan zahtev" }, 400);
      }

      const submittedToken = body.token;
      const submittedPassword = body.password;

      if (
        typeof submittedToken !== "string" ||
        !PASSWORD_RESET_CONFIRM_TOKEN_PATTERN.test(submittedToken)
      ) {
        return invalidCredentialResponse();
      }
      if (
        typeof submittedPassword !== "string" ||
        !isBcryptSafePassword(submittedPassword)
      ) {
        return jsonResponse({ error: "Nova lozinka nije validna" }, 400);
      }

      stage = "PASSWORD_VALIDATION";
      const passwordValidation =
        dependencies.validatePassword(submittedPassword);
      if (!passwordValidation.valid) {
        return jsonResponse(
          {
            error:
              passwordValidation.errors[0] || "Nova lozinka nije validna",
          },
          400,
        );
      }

      stage = "TOKEN_KEYS";
      const keys = dependencies.createLookupKeys(submittedToken);
      if (!keys) return invalidCredentialResponse();

      stage = "HASH_LOOKUP";
      let record = await dependencies.findByCurrentHash(keys.currentHash);
      let lookupKind: "current-hash" | "legacy-plaintext" = "current-hash";

      if (!record) {
        stage = "LEGACY_LOOKUP";
        record = await dependencies.findByLegacyToken(keys.legacyPlaintext);
        lookupKind = "legacy-plaintext";
      }

      if (!record) return invalidCredentialResponse();
      const claim = recordClaim(record, keys, lookupKind);

      stage = "EXPIRY_CHECK";
      const expiryTime = record.expires.getTime();
      if (!Number.isFinite(expiryTime)) {
        throw new Error("Invalid reset clock");
      }

      stage = "PASSWORD_HASH";
      const passwordHash = await dependencies.hashPassword(submittedPassword);

      stage = "RESPONSE_PREPARATION";
      const successResponse = applyPasswordResetConfirmPrivateHeaders(
        await dependencies.prepareSuccessResponse(),
      );

      stage = "COMMIT";
      await dependencies.commitReset(claim, passwordHash);

      return successResponse;
    } catch (error) {
      safelyReportFailure(dependencies.reportFailure, stage);
      if (error instanceof PasswordResetConfirmConflictError) {
        return invalidCredentialResponse();
      }
      return retryResponse();
    }
  };
}
