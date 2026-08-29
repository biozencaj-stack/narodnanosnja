import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET - Servira sliku po ID-u
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const image = await prisma.newsletterImage.findUnique({
      where: { id },
      select: {
        imageData: true,
        contentType: true,
      },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(image.imageData, "base64");

    // Return image with proper content type
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Newsletter image serve error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju slike" },
      { status: 500 }
    );
  }
}
