import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        newsletterOptIn: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju profila" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, newsletterOptIn } = body;

    const updateData: Record<string, unknown> = {};

    if (firstName !== undefined) updateData.firstName = firstName?.trim() || undefined;
    if (lastName !== undefined) updateData.lastName = lastName?.trim() || undefined;
    if (phone !== undefined) updateData.phone = phone?.trim() || undefined;
    if (typeof newsletterOptIn === "boolean") updateData.newsletterOptIn = newsletterOptIn;

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({
      user: {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        newsletterOptIn: updatedUser.newsletterOptIn,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Greška pri ažuriranju profila" },
      { status: 500 }
    );
  }
}
