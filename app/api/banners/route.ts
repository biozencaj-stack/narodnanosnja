import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public API to get active banners by position
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position");

    const where = {
      isActive: true,
      ...(position && { position }),
    };

    const banners = await prisma.banner.findMany({
      where,
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        imageData: true,
        contentType: true,
        linkUrl: true,
        buttonText: true,
        position: true,
      },
    });

    return NextResponse.json({ banners });
  } catch (error) {
    console.error("Get public banners error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju banera" },
      { status: 500 }
    );
  }
}
