import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 5 attempts per minute
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(`reset-confirm:${ip}`, 5)) {
      return NextResponse.json(
        { error: "Previše pokušaja. Pokušajte ponovo za minut." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token i nova lozinka su obavezni" },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }

    // Find reset token
    const resetToken = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Neispravan ili istekao link za reset lozinke" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (resetToken.expires < new Date()) {
      // Delete expired token
      await prisma.passwordReset.delete({
        where: { id: resetToken.id },
      });

      return NextResponse.json(
        { error: "Link za reset lozinke je istekao. Zatražite novi." },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Delete used token
    await prisma.passwordReset.delete({
      where: { id: resetToken.id },
    });

    return NextResponse.json({
      message: "Lozinka uspešno promenjena. Možete se prijaviti.",
    });
  } catch (error) {
    console.error("Password reset confirm error:", error);
    return NextResponse.json(
      { error: "Greška pri promeni lozinke. Pokušajte ponovo." },
      { status: 500 }
    );
  }
}
