import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
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

    await prisma.address.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Adresa obrisana" });
  } catch (error) {
    console.error("Delete address error:", error);
    return NextResponse.json(
      { error: "Greška pri brisanju adrese" },
      { status: 500 }
    );
  }
}
