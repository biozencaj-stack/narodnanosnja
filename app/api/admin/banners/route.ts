import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const banners = await prisma.banner.findMany({
      orderBy: [{ position: "asc" }, { order: "asc" }],
    });

    return NextResponse.json({ banners });
  } catch (error) {
    console.error("Get banners error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju banera" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      subtitle,
      description,
      imageData,
      contentType,
      linkUrl,
      buttonText,
      position,
      isActive,
    } = body;

    const titleObj = typeof title === "object" ? title : { sr: String(title || ""), en: "" };
    if ((!titleObj.sr && !titleObj.en) || !imageData || !contentType) {
      return NextResponse.json(
        { error: "Naslov i slika su obavezni" },
        { status: 400 }
      );
    }

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: "Nedozvoljen format slike" },
        { status: 400 }
      );
    }

    // Get next order number for position
    const maxOrder = await prisma.banner.aggregate({
      _max: { order: true },
      where: { position },
    });

    const banner = await prisma.banner.create({
      data: {
        title: titleObj,
        subtitle: typeof subtitle === "object" ? subtitle : subtitle ? { sr: String(subtitle), en: "" } : null,
        description: typeof description === "object" ? description : description ? { sr: String(description), en: "" } : null,
        imageData,
        contentType,
        linkUrl,
        buttonText: typeof buttonText === "object" ? buttonText : buttonText ? { sr: String(buttonText), en: "" } : null,
        position,
        isActive: isActive ?? true,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    // Invalidate banner cache so changes appear immediately

    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    console.error("Create banner error:", error);
    return NextResponse.json(
      { error: "Greška pri kreiranju banera" },
      { status: 500 }
    );
  }
}
