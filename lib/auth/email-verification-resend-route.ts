import { NextRequest, NextResponse } from "next/server";
import { isTrustedWriteRequest } from "../security/origin";
import { readBoundedJson } from "../security/bounded-json";
import {
  acceptEmailVerificationResend,
  EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE,
  normalizeEmailVerificationResendEmail,
  type EmailVerificationResendFailure,
} from "./email-verification-resend";

export const EMAIL_VERIFICATION_RESEND_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;
export const MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES = 1024;

export type EmailVerificationResendRouteFailure =
  | EmailVerificationResendFailure
  | { stage: "RATE_LIMIT" };

export interface EmailVerificationResendRouteDependencies {
  checkRateLimit: (key: string, limit: number) => boolean;
  schedule: (task: () => Promise<void>) => void;
  processRequest: (normalizedEmail: string) => Promise<void>;
  reportFailure: (failure: EmailVerificationResendRouteFailure) => void;
}

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: EMAIL_VERIFICATION_RESEND_PRIVATE_HEADERS,
  });
}

function safelyReportRateLimitFailure(
  reportFailure: EmailVerificationResendRouteDependencies["reportFailure"],
): void {
  try {
    reportFailure({ stage: "RATE_LIMIT" });
  } catch {
    // Observability must never replace the fail-closed private response.
  }
}

function exactEmailBody(body: unknown): { email: unknown } | null {
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
    keys.length !== 1 ||
    keys[0] !== "email" ||
    !Object.prototype.hasOwnProperty.call(body, "email")
  ) {
    return null;
  }

  return body as { email: unknown };
}

export function createEmailVerificationResendHandler(
  dependencies: EmailVerificationResendRouteDependencies,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    // `/api/auth` is exempt from the global write guard for provider callbacks,
    // so this public mutation must enforce its own trusted-origin check first.
    if (!isTrustedWriteRequest(request.headers)) {
      return jsonResponse(
        { error: "Zahtev za ponovnu potvrdu emaila nije dozvoljen." },
        403,
      );
    }

    // This limiter is deliberately evaluated before the account lookup and is
    // independent of whether the submitted address belongs to an account.
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    let withinRateLimit: boolean;
    try {
      withinRateLimit = dependencies.checkRateLimit(
        `verify-email-resend:${ip}`,
        3,
      );
    } catch {
      safelyReportRateLimitFailure(dependencies.reportFailure);
      return jsonResponse(
        { error: EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE },
        503,
      );
    }

    if (!withinRateLimit) {
      return jsonResponse(
        { error: "Previše pokušaja. Pokušajte ponovo za minut." },
        429,
      );
    }

    const bodyResult = await readBoundedJson(
      request,
      MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES,
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

    const parsedBody = exactEmailBody(bodyResult.value);
    if (!parsedBody) {
      return jsonResponse({ error: "Neispravan zahtev" }, 400);
    }

    const email = normalizeEmailVerificationResendEmail(parsedBody.email);
    if (!email) {
      return jsonResponse(
        { error: "Neispravan format email adrese" },
        400,
      );
    }

    const result = acceptEmailVerificationResend({
      schedule: dependencies.schedule,
      work: () => dependencies.processRequest(email),
      reportFailure: dependencies.reportFailure,
    });

    return jsonResponse(result.body, result.status);
  };
}
