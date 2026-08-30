import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  PasswordChangeError,
  changeAuthenticatedPassword,
  createPrismaPasswordChangeDatabase,
} from "@/lib/auth/password-change";
import { prisma } from "@/lib/db";
import { validatePassword } from "@/lib/auth/password";

const passwordChangeDatabase = createPrismaPasswordChangeDatabase(prisma);
const INVALID_CURRENT_PASSWORD_MESSAGE =
  "Trenutna lozinka nije ispravna";

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (
      typeof currentPassword !== "string" ||
      currentPassword.length === 0 ||
      typeof newPassword !== "string" ||
      newPassword.length === 0
    ) {
      return NextResponse.json(
        { error: "Sva polja su obavezna" },
        { status: 400 },
      );
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors[0] },
        { status: 400 },
      );
    }

    const result = await changeAuthenticatedPassword(
      {
        userId: session.user.id,
        currentPassword,
        newPassword,
      },
      passwordChangeDatabase,
    );

    if (result.kind === "invalid-current-password") {
      return NextResponse.json(
        { error: INVALID_CURRENT_PASSWORD_MESSAGE },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "Lozinka uspešno promenjena" });
  } catch (error) {
    const stage =
      error instanceof PasswordChangeError ? error.stage : "REQUEST";
    // Never log a user id, password/hash, request body or raw DB error.
    console.error("Password update internal failure", { stage });
    return NextResponse.json(
      { error: "Greška pri promeni lozinke" },
      { status: 500 },
    );
  }
}
