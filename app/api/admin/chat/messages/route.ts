import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const unreadOnly = searchParams.get("unread") === "true";

  const where = unreadOnly ? { isRead: false } : {};

  const [messages, total, unreadCount] = await Promise.all([
    prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.chatMessage.count({ where }),
    prisma.chatMessage.count({ where: { isRead: false } }),
  ]);

  return NextResponse.json({
    messages,
    total,
    unreadCount,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, isRead, adminNote } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const message = await prisma.chatMessage.update({
      where: { id },
      data: {
        ...(isRead !== undefined && { isRead }),
        ...(adminNote !== undefined && { adminNote: adminNote || null }),
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Update message error:", error);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
