import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if address belongs to user
    const address = await prisma.address.findUnique({
      where: { id },
    });

    if (!address || address.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Unset all defaults
    await prisma.address.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });

    // Set this one as default
    await prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });

    return NextResponse.json({ message: "Podrazumevana adresa postavljena" });
  } catch (error) {
    console.error("Set default address error:", error);
    return NextResponse.json(
      { error: "Greška pri postavljanju podrazumevane adrese" },
      { status: 500 }
    );
  }
}
