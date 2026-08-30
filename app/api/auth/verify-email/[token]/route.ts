import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorefrontUrl } from "@/lib/config/storefront-url";
import { encode } from "next-auth/jwt";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  authSessionCookieName,
  resolveAuthSecret,
  shouldUseSecureAuthCookies,
} from "@/lib/auth/config";
import {
  commitEmailVerification,
  prepareVerificationSuccessBeforeCommit,
} from "@/lib/auth/email-verification";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  let failureRedirect: URL | undefined;

  try {
    const storefrontUrl = getStorefrontUrl();
    // Every redirect target is validated before reading or mutating a token.
    // Invalid public URL configuration therefore cannot partially verify a user.
    failureRedirect = new URL("/login?error=verification_failed", storefrontUrl);
    const invalidTokenRedirect = new URL(
      "/login?error=invalid_token",
      storefrontUrl,
    );
    const expiredTokenRedirect = new URL(
      "/login?error=expired_token",
      storefrontUrl,
    );
    const successRedirect = new URL(
      "/moj-nalog?verified=true",
      storefrontUrl,
    );
    const { token } = await params;

    if (!token) {
      return NextResponse.redirect(invalidTokenRedirect);
    }

    // Resolve every signing/cookie setting before touching verification data.
    // A broken auth configuration must leave the token retryable.
    const authSecret = resolveAuthSecret();
    const secureCookie = shouldUseSecureAuthCookies();
    const cookieName = authSessionCookieName();

    // Find verification token
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    // Check if token exists
    if (!verification) {
      return NextResponse.redirect(invalidTokenRedirect);
    }

    // Check if token is expired
    if (verification.expires.getTime() <= Date.now()) {
      await prisma.emailVerification.deleteMany({
        where: { id: verification.id, token },
      });
      return NextResponse.redirect(expiredTokenRedirect);
    }

    return await prepareVerificationSuccessBeforeCommit(
      () =>
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
      (sessionToken) => {
        const response = NextResponse.redirect(successRedirect);

        response.cookies.set(cookieName, sessionToken, {
          httpOnly: true,
          secure: secureCookie,
          sameSite: "lax",
          path: "/",
          maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
        });

        return response;
      },
      () =>
        commitEmailVerification(prisma, {
          id: verification.id,
          userId: verification.userId,
          token,
        }),
    );
  } catch (error) {
    console.error("Email verification error:", error);
    if (failureRedirect) return NextResponse.redirect(failureRedirect);
    return NextResponse.json(
      { error: "Email verification configuration failed" },
      { status: 500 },
    );
  }
}
