import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email/auth-emails";
import {
  generateRawCredentialToken,
  hashCredentialToken,
} from "@/lib/auth/credential-token";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 5 attempts per minute
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(`register:${ip}`, 5)) {
      return NextResponse.json(
        { error: "Previše pokušaja. Pokušajte ponovo za minut." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password, firstName, lastName, phone } = body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Sva polja su obavezna" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Neispravan format email adrese" },
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Korisnik sa ovim emailom već postoji" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        role: "CUSTOMER",
        // emailVerified remains null until verification
      },
    });

    // Generate verification token
    const verificationToken = generateRawCredentialToken();
    const verificationTokenHash = hashCredentialToken(
      "email-verification",
      verificationToken,
    );
    if (!verificationTokenHash) {
      throw new Error("Verification credential generation failed");
    }
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save verification token
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        tokenHash: verificationTokenHash,
        expires: tokenExpiry,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.firstName, verificationToken);
    } catch {
      // Do not log the recipient or raw SMTP details. Durable delivery and a
      // real resend flow remain a separate P1 registration task.
      console.error("Registration verification delivery failed", {
        stage: "DELIVERY",
      });
    }

    return NextResponse.json(
      {
        message: "Nalog uspešno kreiran. Za aktivaciju je potrebna email potvrda.",
        requiresVerification: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
      { status: 201 }
    );
  } catch {
    // Do not expose submitted account data or raw persistence failures.
    console.error("Registration internal failure", { stage: "REQUEST" });
    return NextResponse.json(
      { error: "Greška pri registraciji. Pokušajte ponovo." },
      { status: 500 }
    );
  }
}
