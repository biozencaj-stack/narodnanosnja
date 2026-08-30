import { NextRequest, NextResponse } from "next/server";
import {
  acceptPasswordResetRequest,
  normalizePasswordResetEmail,
  type PasswordResetFailure,
} from "./password-reset-request";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

export interface PasswordResetRequestHandlerDependencies {
  checkRateLimit: (key: string, limit: number) => boolean;
  schedule: (task: () => Promise<void>) => void;
  processRequest: (normalizedEmail: string) => Promise<void>;
  reportFailure: (failure: PasswordResetFailure) => void;
}

export function createPasswordResetRequestHandler(
  dependencies: PasswordResetRequestHandlerDependencies,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    // Rate limiting is deliberately independent of account existence.
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!dependencies.checkRateLimit(`reset-request:${ip}`, 3)) {
      return NextResponse.json(
        { error: "Previše pokušaja. Pokušajte ponovo za minut." },
        { status: 429, headers: NO_STORE_HEADERS },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Neispravan zahtev" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const submittedEmail =
      typeof body === "object" && body !== null && "email" in body
        ? (body as { email?: unknown }).email
        : undefined;
    const email = normalizePasswordResetEmail(submittedEmail);
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
