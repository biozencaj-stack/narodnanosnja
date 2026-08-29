import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const colors = await prisma.color.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ colors });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, hex, active } = await request.json();
    if (!name || !hex) {
      return NextResponse.json(
        { error: "Name and hex are required" },
        { status: 400 },
      );
    }

    const color = await prisma.color.create({
      data: { name, hex, active: active ?? true },
    });
    return NextResponse.json({ color }, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Boja sa tim nazivom već postoji" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create color" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, name, hex, active } = await request.json();
    if (!id)
      return NextResponse.json({ error: "ID required" }, { status: 400 });

    const color = await prisma.color.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(hex !== undefined && { hex }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json({ color });
  } catch {
    return NextResponse.json(
      { error: "Failed to update color" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    await prisma.color.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete color" },
      { status: 500 },
    );
  }
}
