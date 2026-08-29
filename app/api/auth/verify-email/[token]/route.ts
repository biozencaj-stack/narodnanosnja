import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encode } from "next-auth/jwt";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_token", SITE_URL)
      );
    }

    // Find verification token
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    // Check if token exists
    if (!verification) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_token", SITE_URL)
      );
    }

    // Check if token is expired
    if (verification.expires < new Date()) {
      // Delete expired token
      await prisma.emailVerification.delete({
        where: { id: verification.id },
      });
      return NextResponse.redirect(
        new URL("/login?error=expired_token", SITE_URL)
      );
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: verification.userId },
      data: { emailVerified: new Date() },
    });

    // Delete verification token
    await prisma.emailVerification.delete({
      where: { id: verification.id },
    });

    // Create session token for magic login
    const sessionToken = await encode({
      token: {
        id: verification.user.id,
        email: verification.user.email,
        role: verification.user.role,
        firstName: verification.user.firstName,
        lastName: verification.user.lastName,
        sub: verification.user.id,
      },
      secret: NEXTAUTH_SECRET,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Create response with redirect
    const response = NextResponse.redirect(
      new URL("/moj-nalog?verified=true", SITE_URL)
    );

    // Set the session cookie
    const cookieName = process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.redirect(
      new URL("/login?error=verification_failed", SITE_URL)
    );
  }
}
