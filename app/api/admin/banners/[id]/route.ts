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

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, subtitle, description, linkUrl, buttonText, position, isActive, order, imageData, contentType } = body;

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(description !== undefined && { description }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(buttonText !== undefined && { buttonText }),
        ...(position !== undefined && { position }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
        ...(imageData !== undefined && { imageData }),
        ...(contentType !== undefined && { contentType }),
      },
    });

    // Invalidate banner cache so changes appear immediately

    return NextResponse.json({ banner });
  } catch (error) {
    console.error("Update banner error:", error);
    return NextResponse.json(
      { error: "Greška pri ažuriranju banera" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.banner.delete({
      where: { id },
    });

    // Invalidate banner cache so changes appear immediately

    return NextResponse.json({ message: "Baner obrisan" });
  } catch (error) {
    console.error("Delete banner error:", error);
    return NextResponse.json(
      { error: "Greška pri brisanju banera" },
      { status: 500 }
    );
  }
}
