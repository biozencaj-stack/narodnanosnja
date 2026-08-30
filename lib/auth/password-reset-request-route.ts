import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "../security/bounded-json";
import { isTrustedWriteRequest } from "../security/origin";
import {
  acceptPasswordResetRequest,
  normalizePasswordResetEmail,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
  type PasswordResetFailure,
} from "./password-reset-request";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};
export const MAX_PASSWORD_RESET_REQUEST_JSON_BYTES = 1024;

export type PasswordResetRequestRouteFailure =
  | PasswordResetFailure
  | { stage: "RATE_LIMIT" };

export interface PasswordResetRequestHandlerDependencies {
  checkRateLimit: (key: string, limit: number) => boolean;
  schedule: (task: () => Promise<void>) => void;
  processRequest: (normalizedEmail: string) => Promise<void>;
  reportFailure: (failure: PasswordResetRequestRouteFailure) => void;
}

function safelyReportRouteFailure(
  reportFailure: PasswordResetRequestHandlerDependencies["reportFailure"],
  failure: PasswordResetRequestRouteFailure,
): void {
  try {
    reportFailure(failure);
  } catch {
    // Observability cannot replace the generic, private route response.
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

export function createPasswordResetRequestHandler(
  dependencies: PasswordResetRequestHandlerDependencies,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    // `/api/auth` is exempt from the global write guard for provider callbacks,
    // so this public mutation must enforce its own trusted-origin check first.
    if (!isTrustedWriteRequest(request.headers)) {
      return NextResponse.json(
        { error: "Zahtev za resetovanje lozinke nije dozvoljen." },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    // Rate limiting is deliberately independent of account existence.
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    let withinRateLimit: boolean;
    try {
      withinRateLimit = dependencies.checkRateLimit(
        `reset-request:${ip}`,
        3,
      );
    } catch {
      safelyReportRouteFailure(dependencies.reportFailure, {
        stage: "RATE_LIMIT",
      });
      return NextResponse.json(
        { error: PASSWORD_RESET_UNAVAILABLE_MESSAGE },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    if (!withinRateLimit) {
      return NextResponse.json(
        { error: "Previše pokušaja. Pokušajte ponovo za minut." },
        { status: 429, headers: NO_STORE_HEADERS },
      );
    }

    const bodyResult = await readBoundedJson(
      request,
      MAX_PASSWORD_RESET_REQUEST_JSON_BYTES,
    );
    if (!bodyResult.ok) {
      const error =
        bodyResult.status === 413
          ? "Zahtev je prevelik."
          : bodyResult.status === 415
            ? "Nepodržan format zahteva."
            : "Neispravan zahtev";
      return NextResponse.json(
        { error },
        { status: bodyResult.status, headers: NO_STORE_HEADERS },
      );
    }
    const body = exactEmailBody(bodyResult.value);
    if (!body) {
      return NextResponse.json(
        { error: "Neispravan zahtev" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const email = normalizePasswordResetEmail(body.email);
    if (!email) {
      return NextResponse.json(
        { error: "Neispravan format email adrese" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const result = acceptPasswordResetRequest({
      schedule: dependencies.schedule,
      work: () => dependencies.processRequest(email),
      reportFailure: dependencies.reportFailure,
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE_HEADERS,
    });
  };
}
