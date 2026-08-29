import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateResetToken } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/auth-emails";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 3 attempts per minute
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(`reset-request:${ip}`, 3)) {
      return NextResponse.json(
        { error: "Previše pokušaja. Pokušajte ponovo za minut." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email adresa je obavezna" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message:
          "Ako nalog postoji, poslali smo vam email sa uputstvima za reset lozinke.",
      });
    }

    // Delete any existing reset tokens for this user
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Generate new reset token
    const token = generateResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expires,
      },
    });

    // Send email
    await sendPasswordResetEmail(user.email, user.firstName, token);

    return NextResponse.json({
      message:
        "Ako nalog postoji, poslali smo vam email sa uputstvima za reset lozinke.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Greška pri slanju emaila. Pokušajte ponovo." },
      { status: 500 }
    );
  }
}
