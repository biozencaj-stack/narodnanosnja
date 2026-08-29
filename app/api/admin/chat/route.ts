import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/security/html";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const faqs = await prisma.chatFAQ.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ faqs });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { question, answer, category, sortOrder, active } = body;

    const safeAnswer = sanitizeRichHtml(answer);
    if (!question || !safeAnswer.trim()) {
      return NextResponse.json({ error: "Pitanje i odgovor su obavezni" }, { status: 400 });
    }

    const faq = await prisma.chatFAQ.create({
      data: {
        question,
        answer: safeAnswer,
        category: category || null,
        sortOrder: sortOrder ?? 0,
        active: active ?? true,
      },
    });

    return NextResponse.json({ faq }, { status: 201 });
  } catch (error) {
    console.error("Create FAQ error:", error);
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, question, answer, category, sortOrder, active } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const safeAnswer =
      answer === undefined ? undefined : sanitizeRichHtml(answer);
    if (safeAnswer !== undefined && !safeAnswer.trim()) {
      return NextResponse.json(
        { error: "Odgovor ne sme biti prazan" },
        { status: 400 },
      );
    }

    const faq = await prisma.chatFAQ.update({
      where: { id },
      data: {
        ...(question !== undefined && { question }),
        ...(safeAnswer !== undefined && { answer: safeAnswer }),
        ...(category !== undefined && { category: category || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json({ faq });
  } catch (error) {
    console.error("Update FAQ error:", error);
    return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.chatFAQ.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete FAQ error:", error);
    return NextResponse.json({ error: "Failed to delete FAQ" }, { status: 500 });
  }
}
