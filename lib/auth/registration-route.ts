import { NextRequest, NextResponse } from "next/server";
import { normalizeEmailAddress } from "./email-address";
import { isBcryptSafePassword } from "./password";
import { isTrustedWriteRequest } from "../security/origin";
import { readBoundedJson } from "../security/bounded-json";
import type { RegistrationInput, RegistrationResult } from "./registration";

export const REGISTRATION_ACCEPTED_MESSAGE =
  "Ako je registracija moguća, uputstvo za potvrdu biće poslato na unetu adresu.";
export const REGISTRATION_UNAVAILABLE_MESSAGE =
  "Registracija trenutno nije dostupna. Pokušajte ponovo.";

export const MAX_REGISTRATION_NAME_LENGTH = 100;
export const MAX_REGISTRATION_PHONE_LENGTH = 32;
export const MAX_REGISTRATION_JSON_BYTES = 4096;

const REGISTRATION_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;
const ALLOWED_BODY_FIELDS = new Set([
  "email",
  "password",
  "firstName",
  "lastName",
  "phone",
]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export type RegistrationFailureStage =
  | "RATE_LIMIT"
  | "TOKEN_PREPARATION"
  | "PASSWORD_HASH"
  | "PERSISTENCE"
  | "SCHEDULING"
  | "DELIVERY"
  | "RECOVERY"
  | "RESPONSE_TIMING";

export interface RegistrationFailure {
  stage: RegistrationFailureStage;
}

export interface RegistrationHandlerDependencies {
  checkRateLimit: (key: string, limit: number) => boolean;
  validatePassword: (password: string) => PasswordValidation;
  generateToken: () => string;
  hashToken: (token: string) => string | null;
  prepareDelivery: (
    email: string,
    firstName: string,
    token: string,
  ) => () => Promise<void>;
  hashPassword: (password: string) => Promise<string>;
  register: (input: RegistrationInput) => Promise<RegistrationResult>;
  recoverExistingVerification: (normalizedEmail: string) => Promise<void>;
  schedule: (task: () => Promise<void>) => void;
  protectResponseTiming: (startedAt: number) => Promise<void>;
  now: () => Date | Promise<Date>;
  reportFailure: (failure: RegistrationFailure) => void;
}

interface ValidatedRegistrationBody {
  normalizedEmail: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: REGISTRATION_PRIVATE_HEADERS,
  });
}

function safelyReportFailure(
  reportFailure: RegistrationHandlerDependencies["reportFailure"],
  stage: RegistrationFailureStage,
): void {
  try {
    reportFailure({ stage });
  } catch {
    // Observability must never expose account-dependent behavior.
  }
}

function normalizeRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function parseRegistrationBody(body: unknown):
  | { value: ValidatedRegistrationBody }
  | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Neispravni podaci za registraciju" };
  }

  if (Object.keys(body).some((key) => !ALLOWED_BODY_FIELDS.has(key))) {
    return { error: "Neispravni podaci za registraciju" };
  }

  const input = body as Record<string, unknown>;
  const normalizedEmail = normalizeEmailAddress(input.email);
  if (!normalizedEmail) {
    return { error: "Neispravan format email adrese" };
  }

  const firstName = normalizeRequiredText(
    input.firstName,
    MAX_REGISTRATION_NAME_LENGTH,
  );
  const lastName = normalizeRequiredText(
    input.lastName,
    MAX_REGISTRATION_NAME_LENGTH,
  );
  if (!firstName || !lastName) {
    return { error: "Ime i prezime nisu validni" };
  }

  if (typeof input.password !== "string") {
    return { error: "Lozinka nije validna" };
  }

  let phone: string | null = null;
  if (input.phone !== undefined) {
    if (typeof input.phone !== "string") {
      return { error: "Broj telefona nije validan" };
    }
    const submittedPhone = input.phone.trim();
    if (
      submittedPhone.length > MAX_REGISTRATION_PHONE_LENGTH ||
      CONTROL_CHARACTER_PATTERN.test(submittedPhone)
    ) {
      return { error: "Broj telefona nije validan" };
    }
    phone = submittedPhone || null;
  }

  return {
    value: {
      normalizedEmail,
      password: input.password,
      firstName,
      lastName,
      phone,
    },
  };
}

export function createRegistrationHandler(
  dependencies: RegistrationHandlerDependencies,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    // /api/auth is globally exempt for provider callbacks, so registration
    // enforces same-origin before rate limiting, parsing, bcrypt or persistence.
    if (!isTrustedWriteRequest(request.headers)) {
      return jsonResponse({ error: "Zahtev za registraciju nije dozvoljen." }, 403);
    }

    const privateResponseStartedAt = performance.now();
    let stage: RegistrationFailureStage = "RATE_LIMIT";

    const protectResponseTimingSafely = async (): Promise<void> => {
      try {
        await dependencies.protectResponseTiming(privateResponseStartedAt);
      } catch {
        safelyReportFailure(dependencies.reportFailure, "RESPONSE_TIMING");
      }
    };

    try {
      const ip = request.headers.get("x-forwarded-for") || "unknown";
      if (!dependencies.checkRateLimit(`register:${ip}`, 5)) {
        return jsonResponse(
          { error: "Previše pokušaja. Pokušajte ponovo za minut." },
          429,
        );
      }

      const bodyResult = await readBoundedJson(
        request,
        MAX_REGISTRATION_JSON_BYTES,
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

      const parsed = parseRegistrationBody(bodyResult.value);
      if ("error" in parsed) {
        return jsonResponse({ error: parsed.error }, 400);
      }
      const submitted = parsed.value;

      if (!isBcryptSafePassword(submitted.password)) {
        return jsonResponse({ error: "Lozinka nije validna" }, 400);
      }
      const passwordValidation = dependencies.validatePassword(
        submitted.password,
      );
      if (!passwordValidation.valid) {
        return jsonResponse(
          {
            error: passwordValidation.errors[0] || "Lozinka nije validna",
          },
          400,
        );
      }

      stage = "TOKEN_PREPARATION";
      const token = dependencies.generateToken();
      const tokenHash = dependencies.hashToken(token);
      if (!tokenHash) throw new Error("Invalid verification credential");

      // Fail before persistence if canonical URL, SMTP configuration or email
      // preparation is unavailable. The returned task performs only delivery.
      const delivery = dependencies.prepareDelivery(
        submitted.normalizedEmail,
        submitted.firstName,
        token,
      );
      stage = "PASSWORD_HASH";
      const passwordHash = await dependencies.hashPassword(submitted.password);

      stage = "PERSISTENCE";
      // Anchor TTL and cooldown after the intentionally slow bcrypt operation,
      // immediately before the atomic persistence boundary.
      const issuedAt = await dependencies.now();
      if (!Number.isFinite(issuedAt.getTime())) {
        throw new Error("Invalid registration clock");
      }
      const result = await dependencies.register({
        normalizedEmail: submitted.normalizedEmail,
        passwordHash,
        firstName: submitted.firstName,
        lastName: submitted.lastName,
        phone: submitted.phone,
        legacyPlaintextToken: token,
        tokenHash,
        issuedAt,
      });

      stage = "SCHEDULING";
      try {
        dependencies.schedule(async () => {
          if (result.kind === "existing") {
            try {
              // A repeated registration is also a private recovery path. The
              // resend service applies verification state, cooldown and quota
              // checks before it can rotate or deliver any credential.
              await dependencies.recoverExistingVerification(
                submitted.normalizedEmail,
              );
            } catch {
              safelyReportFailure(dependencies.reportFailure, "RECOVERY");
            }
            return;
          }

          try {
            await delivery();
          } catch {
            // SMTP acceptance can be ambiguous. Keep the committed credential so
            // a possibly delivered link remains valid and recovery can resend it.
            safelyReportFailure(dependencies.reportFailure, "DELIVERY");
          }
        });
      } catch {
        // Persistence already succeeded. Keep the same public accepted result;
        // the explicit resend route remains the recovery path when this
        // non-durable scheduler is unavailable.
        safelyReportFailure(dependencies.reportFailure, "SCHEDULING");
      }

      await protectResponseTimingSafely();

      // This body and status are deliberately byte-identical for a newly
      // created account and an email that already exists.
      return jsonResponse({ message: REGISTRATION_ACCEPTED_MESSAGE }, 202);
    } catch {
      safelyReportFailure(dependencies.reportFailure, stage);
      if (stage === "PERSISTENCE") {
        await protectResponseTimingSafely();
      }
      return jsonResponse({ error: REGISTRATION_UNAVAILABLE_MESSAGE }, 503);
    }
  };
}
