import type { Role } from "@prisma/client";
import { encode, getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getStorefrontUrl } from "@/lib/config/storefront-url";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  authSessionCookieName,
  resolveAuthSecret,
  shouldUseSecureAuthCookies,
} from "@/lib/auth/config";
import {
  EmailVerificationConflictError,
  commitEmailVerification,
  createStoredEmailVerificationClaim,
} from "@/lib/auth/email-verification";
import { createCredentialTokenLookupKeys } from "@/lib/auth/credential-token";
import {
  EMAIL_VERIFICATION_TOKEN_PATTERN,
  createEmailVerificationJsonResponse,
  createEmailVerificationRedirectResponse,
  createEmailVerificationRouteHandlers,
  isCanonicalEmailVerificationRequest,
  type EmailVerificationRouteContext,
  type EmailVerificationRouteFailure,
  type EmailVerificationRouteRecord,
} from "@/lib/auth/email-verification-route";
import { isTrustedWriteRequest } from "@/lib/security/origin";

interface StoredEmailVerification extends EmailVerificationRouteRecord {
  token: string | null;
  tokenHash: string | null;
  user: {
    id: string;
    email: string;
    role: Role;
    firstName: string;
    lastName: string;
  };
}

type RouteFailureStage =
  | EmailVerificationRouteFailure["stage"]
  | "CONFIGURATION";

function reportFailure({ stage }: { stage: RouteFailureStage }): void {
  // Never log the request URL, submitted token or raw database/JWT error.
  console.error("Email verification internal failure", { stage });
}

function unavailableResponse() {
  return createEmailVerificationJsonResponse(
    { error: "Potvrda emaila trenutno nije dostupna. Pokušajte ponovo." },
    503,
  );
}

function forbiddenResponse() {
  return createEmailVerificationJsonResponse(
    { error: "Zahtev za potvrdu emaila nije dozvoljen." },
    403,
  );
}

function confirmationNavigationResponse(
  submittedToken: string,
  storefrontUrl: URL,
) {
  const destination = EMAIL_VERIFICATION_TOKEN_PATTERN.test(submittedToken)
    ? new URL(
        "/verify-email/" + encodeURIComponent(submittedToken),
        storefrontUrl,
      )
    : new URL("/login?error=invalid_token", storefrontUrl);
  return createEmailVerificationRedirectResponse(destination);
}

function configurationFailureResponse(
  submittedToken: string,
  knownStorefrontUrl?: URL,
) {
  if (EMAIL_VERIFICATION_TOKEN_PATTERN.test(submittedToken)) {
    try {
      const retryUrl = new URL(
        "/verify-email/" + encodeURIComponent(submittedToken),
        knownStorefrontUrl ?? getStorefrontUrl(),
      );
      retryUrl.searchParams.set("error", "temporary");
      return createEmailVerificationRedirectResponse(retryUrl);
    } catch {
      // The canonical URL itself is unavailable; use the generic 503 below.
    }
  }

  return unavailableResponse();
}

function createProductionHandlers(
  submittedToken: string,
  storefrontUrl: URL,
) {
  // Resolve every URL, signing and cookie setting before the first DB read.
  // A broken deployment configuration therefore leaves the token retryable.
  const authSecret = resolveAuthSecret();
  const secureCookie = shouldUseSecureAuthCookies();
  const cookieName = authSessionCookieName();

  const invalidTokenUrl = new URL("/login?error=invalid_token", storefrontUrl);
  const expiredTokenUrl = new URL("/login?error=expired_token", storefrontUrl);
  const successUrl = new URL("/moj-nalog?verified=true", storefrontUrl);
  const confirmationUrl = EMAIL_VERIFICATION_TOKEN_PATTERN.test(submittedToken)
    ? new URL(
        "/verify-email/" + encodeURIComponent(submittedToken),
        storefrontUrl,
      )
    : invalidTokenUrl;
  const retryUrl = new URL(confirmationUrl);
  retryUrl.searchParams.set("error", "temporary");
  const sessionMismatchUrl = new URL(confirmationUrl);
  sessionMismatchUrl.searchParams.set("error", "session_mismatch");

  return createEmailVerificationRouteHandlers<StoredEmailVerification>({
    getConfirmationUrl(token) {
      if (!EMAIL_VERIFICATION_TOKEN_PATTERN.test(token)) {
        return invalidTokenUrl;
      }
      return new URL(
        "/verify-email/" + encodeURIComponent(token.toLowerCase()),
        storefrontUrl,
      );
    },
    async findVerification(token) {
      const lookup = createCredentialTokenLookupKeys(
        "email-verification",
        token,
      );
      if (!lookup) return null;

      const current = await prisma.emailVerification.findUnique({
        where: { tokenHash: lookup.currentHash },
        include: { user: true },
      });
      if (current) return current;

      // Plaintext is a temporary compatibility fallback for rows created
      // before tokenHash existed. A current row may never downgrade to it.
      return prisma.emailVerification.findFirst({
        where: {
          token: lookup.legacyPlaintext,
          tokenHash: null,
        },
        include: { user: true },
      });
    },
    async getCurrentSessionUserId(request) {
      const currentSession = await getToken({
        req: request,
        secret: authSecret,
        secureCookie,
        cookieName,
      });
      const userId = currentSession?.id ?? currentSession?.sub;
      return typeof userId === "string" ? userId : null;
    },
    issueSessionToken: (verification) =>
      encode({
        token: {
          id: verification.user.id,
          email: verification.user.email,
          role: verification.user.role,
          firstName: verification.user.firstName,
          lastName: verification.user.lastName,
          sub: verification.user.id,
        },
        secret: authSecret,
        maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
      }),
    prepareSuccessResponse(sessionToken) {
      const response = createEmailVerificationRedirectResponse(successUrl);
      response.cookies.set(cookieName, sessionToken, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
      });
      return response;
    },
    commitVerification: (verifiedAt, verification) => {
      const claim = createStoredEmailVerificationClaim(verification);
      if (!claim) throw new EmailVerificationConflictError();
      return commitEmailVerification(prisma, claim, verifiedAt);
    },
    untrustedWriteResponse: forbiddenResponse,
    invalidTokenResponse: () =>
      createEmailVerificationRedirectResponse(invalidTokenUrl),
    expiredTokenResponse: () =>
      createEmailVerificationRedirectResponse(expiredTokenUrl),
    sessionMismatchResponse: () =>
      createEmailVerificationRedirectResponse(sessionMismatchUrl),
    retryResponse: () => createEmailVerificationRedirectResponse(retryUrl),
    reportFailure,
  });
}

async function resolveRouteContext(
  context: EmailVerificationRouteContext,
): Promise<{ token: string; context: EmailVerificationRouteContext } | null> {
  try {
    const { token } = await context.params;
    const submittedToken = typeof token === "string" ? token : "";
    return {
      token: submittedToken,
      context: { params: Promise.resolve({ token: submittedToken }) },
    };
  } catch {
    reportFailure({ stage: "PARAMS" });
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: EmailVerificationRouteContext,
) {
  const resolved = await resolveRouteContext(context);
  if (!resolved) return unavailableResponse();

  try {
    const storefrontUrl = getStorefrontUrl();
    return await createProductionHandlers(resolved.token, storefrontUrl).GET(
      request,
      resolved.context,
    );
  } catch {
    reportFailure({ stage: "CONFIGURATION" });
    return configurationFailureResponse(resolved.token);
  }
}

export async function HEAD(
  request: NextRequest,
  context: EmailVerificationRouteContext,
) {
  const resolved = await resolveRouteContext(context);
  if (!resolved) return unavailableResponse();

  try {
    const storefrontUrl = getStorefrontUrl();
    return await createProductionHandlers(resolved.token, storefrontUrl).HEAD(
      request,
      resolved.context,
    );
  } catch {
    reportFailure({ stage: "CONFIGURATION" });
    return configurationFailureResponse(resolved.token);
  }
}

export async function POST(
  request: NextRequest,
  context: EmailVerificationRouteContext,
) {
  // This must run before URL/auth configuration and every DB/session read.
  // The factory repeats the check so the invariant cannot be lost in tests.
  if (!isTrustedWriteRequest(request.headers)) return forbiddenResponse();

  const resolved = await resolveRouteContext(context);
  if (!resolved) return unavailableResponse();

  let storefrontUrl: URL;
  try {
    storefrontUrl = getStorefrontUrl();
  } catch {
    reportFailure({ stage: "CONFIGURATION" });
    return unavailableResponse();
  }

  // A host-only session cookie issued on an alias would be lost when the
  // browser follows the canonical success redirect. Canonicalize first,
  // without looking up or consuming the token.
  if (!isCanonicalEmailVerificationRequest(request.headers, storefrontUrl)) {
    return confirmationNavigationResponse(resolved.token, storefrontUrl);
  }

  try {
    return await createProductionHandlers(resolved.token, storefrontUrl).POST(
      request,
      resolved.context,
    );
  } catch {
    reportFailure({ stage: "CONFIGURATION" });
    return configurationFailureResponse(resolved.token, storefrontUrl);
  }
}
