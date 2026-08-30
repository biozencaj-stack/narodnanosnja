import { NextRequest, NextResponse } from "next/server";
import {
  EmailVerificationConflictError,
  EmailVerificationExpiredError,
  prepareVerificationSuccessBeforeCommit,
} from "./email-verification";
import { normalizeRawCredentialToken } from "./credential-token";
import { isTrustedWriteRequest } from "../security/origin";

export const EMAIL_VERIFICATION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export const EMAIL_VERIFICATION_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

type HeaderReader = Pick<Headers, "get">;

/**
 * A verification session cookie is host-only. Refuse to consume a token on an
 * alias origin when the success redirect belongs to the canonical storefront,
 * otherwise the browser would lose the freshly issued session at redirect.
 * This check runs only after the general same-origin write guard.
 */
export function isCanonicalEmailVerificationRequest(
  headers: HeaderReader,
  canonicalStorefrontUrl: URL,
): boolean {
  const submittedOrigin = headers.get("origin");
  if (submittedOrigin) {
    try {
      return new URL(submittedOrigin).origin === canonicalStorefrontUrl.origin;
    } catch {
      return false;
    }
  }

  return (
    headers.get("host")?.trim().toLowerCase() ===
    canonicalStorefrontUrl.host.toLowerCase()
  );
}

type Awaitable<T> = T | Promise<T>;

export interface EmailVerificationRouteContext {
  params: Promise<{ token?: string }>;
}

export interface EmailVerificationRouteRecord {
  id: string;
  userId: string;
  expires: Date;
}

export type EmailVerificationRouteFailureStage =
  | "PARAMS"
  | "LOOKUP"
  | "EXPIRY_CHECK"
  | "CURRENT_SESSION"
  | "SESSION_ISSUE"
  | "RESPONSE_PREPARATION"
  | "COMMIT";

export interface EmailVerificationRouteFailure {
  stage: EmailVerificationRouteFailureStage;
}

type RequestResponseFactory = (
  request: NextRequest,
) => Awaitable<NextResponse>;

export interface EmailVerificationRouteDependencies<
  TVerification extends EmailVerificationRouteRecord,
> {
  getConfirmationUrl: (
    token: string,
    request: NextRequest,
  ) => Awaitable<URL | string>;
  findVerification: (token: string) => Promise<TVerification | null>;
  getCurrentSessionUserId: (request: NextRequest) => Promise<string | null>;
  issueSessionToken: (verification: TVerification) => Promise<string>;
  prepareSuccessResponse: (
    sessionToken: string,
    verification: TVerification,
    request: NextRequest,
  ) => Awaitable<NextResponse>;
  commitVerification: (
    verification: TVerification,
  ) => Promise<void>;
  untrustedWriteResponse: RequestResponseFactory;
  invalidTokenResponse: RequestResponseFactory;
  expiredTokenResponse: RequestResponseFactory;
  sessionMismatchResponse: RequestResponseFactory;
  retryResponse: RequestResponseFactory;
  reportFailure: (failure: EmailVerificationRouteFailure) => void;
}

/** Applies the non-cacheable, non-indexable policy to every public outcome. */
export function applyEmailVerificationPrivateHeaders<
  TResponse extends NextResponse,
>(response: TResponse): TResponse {
  for (const [name, value] of Object.entries(
    EMAIL_VERIFICATION_PRIVATE_HEADERS,
  )) {
    response.headers.set(name, value);
  }
  return response;
}

/** Small production-safe fallback for failures that occur before DI is ready. */
export function createEmailVerificationJsonResponse(
  body: unknown,
  status: number,
): NextResponse {
  return applyEmailVerificationPrivateHeaders(
    NextResponse.json(body, { status }),
  );
}

/** Always uses See Other so a browser never replays a verification POST. */
export function createEmailVerificationRedirectResponse(
  location: URL | string,
): NextResponse {
  return applyEmailVerificationPrivateHeaders(
    NextResponse.redirect(location, 303),
  );
}

async function prepareFailureResponse(
  factory: RequestResponseFactory,
  request: NextRequest,
): Promise<NextResponse> {
  const response = await factory(request);

  // A prepared success response may already contain an authentication cookie
  // when its later commit loses a race. Never let a failure path return one.
  response.headers.delete("set-cookie");
  return applyEmailVerificationPrivateHeaders(response);
}

function safelyReportFailure(
  reportFailure: EmailVerificationRouteDependencies<EmailVerificationRouteRecord>["reportFailure"],
  stage: EmailVerificationRouteFailureStage,
): void {
  try {
    // Deliberately report only a coarse stage: never a token or raw exception.
    reportFailure({ stage });
  } catch {
    // Observability must not change the public verification result.
  }
}

export function createEmailVerificationRouteHandlers<
  TVerification extends EmailVerificationRouteRecord,
>(dependencies: EmailVerificationRouteDependencies<TVerification>) {
  async function legacyRedirect(
    request: NextRequest,
    context: EmailVerificationRouteContext,
  ): Promise<NextResponse> {
    const { token } = await context.params;
    const confirmationUrl = await dependencies.getConfirmationUrl(
      typeof token === "string" ? token : "",
      request,
    );

    // GET and HEAD are navigation-only. In particular, they never perform a
    // lookup, issue a session or consume/clean up a verification token.
    return createEmailVerificationRedirectResponse(confirmationUrl);
  }

  async function POST(
    request: NextRequest,
    context: EmailVerificationRouteContext,
  ): Promise<NextResponse> {
    let stage: EmailVerificationRouteFailureStage = "PARAMS";

    try {
      // /api/auth is exempt from the global write guard for NextAuth provider
      // callbacks, so this mutating endpoint must enforce same-origin locally.
      if (!isTrustedWriteRequest(request.headers)) {
        return await prepareFailureResponse(
          dependencies.untrustedWriteResponse,
          request,
        );
      }

      const { token: submittedToken } = await context.params;
      const token = normalizeRawCredentialToken(submittedToken);
      if (!token) {
        return await prepareFailureResponse(
          dependencies.invalidTokenResponse,
          request,
        );
      }

      stage = "LOOKUP";
      const verification = await dependencies.findVerification(token);
      if (!verification) {
        return await prepareFailureResponse(
          dependencies.invalidTokenResponse,
          request,
        );
      }

      stage = "EXPIRY_CHECK";
      const expiresAt = verification.expires.getTime();
      if (!Number.isFinite(expiresAt)) {
        throw new Error("Invalid verification clock");
      }

      stage = "CURRENT_SESSION";
      const currentSessionUserId =
        await dependencies.getCurrentSessionUserId(request);
      if (
        currentSessionUserId !== null &&
        currentSessionUserId !== verification.userId
      ) {
        return await prepareFailureResponse(
          dependencies.sessionMismatchResponse,
          request,
        );
      }

      return await prepareVerificationSuccessBeforeCommit(
        async () => {
          stage = "SESSION_ISSUE";
          return dependencies.issueSessionToken(verification);
        },
        async (sessionToken) => {
          stage = "RESPONSE_PREPARATION";
          const response = await dependencies.prepareSuccessResponse(
            sessionToken,
            verification,
            request,
          );
          return applyEmailVerificationPrivateHeaders(response);
        },
        async () => {
          stage = "COMMIT";
          await dependencies.commitVerification(verification);
        },
      );
    } catch (error) {
      if (error instanceof EmailVerificationExpiredError) {
        return await prepareFailureResponse(
          dependencies.expiredTokenResponse,
          request,
        );
      }

      safelyReportFailure(dependencies.reportFailure, stage);

      if (error instanceof EmailVerificationConflictError) {
        return await prepareFailureResponse(
          dependencies.invalidTokenResponse,
          request,
        );
      }

      return await prepareFailureResponse(dependencies.retryResponse, request);
    }
  }

  return {
    GET: legacyRedirect,
    HEAD: legacyRedirect,
    POST,
  };
}
