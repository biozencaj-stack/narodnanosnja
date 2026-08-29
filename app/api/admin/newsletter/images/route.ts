import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// GET - Lista svih slika
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const images = await prisma.newsletterImage.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        imageData: true,
        contentType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Newsletter images fetch error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju slika" },
      { status: 500 }
    );
  }
}

// POST - Upload nove slike
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, imageData, contentType } = body;

    // Validacija
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Naziv slike je obavezan" },
        { status: 400 }
      );
    }

    if (!imageData || typeof imageData !== "string") {
      return NextResponse.json(
        { error: "Slika je obavezna" },
        { status: 400 }
      );
    }

    if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "Dozvoljeni formati: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Provera veličine (base64 je ~33% veći od originalnog fajla)
    const approximateSize = (imageData.length * 3) / 4;
    if (approximateSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Maksimalna veličina slike je 5MB" },
        { status: 400 }
      );
    }

    const image = await prisma.newsletterImage.create({
      data: {
        name: name.trim(),
        imageData,
        contentType,
      },
    });

    return NextResponse.json({
      success: true,
      image: {
        id: image.id,
        name: image.name,
        imageData: image.imageData,
        contentType: image.contentType,
        createdAt: image.createdAt,
      },
    });
  } catch (error) {
    console.error("Newsletter image upload error:", error);
    return NextResponse.json(
      { error: "Greška pri uploadovanju slike" },
      { status: 500 }
    );
  }
}

// DELETE - Brisanje slike
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID slike je obavezan" },
        { status: 400 }
      );
    }

    await prisma.newsletterImage.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter image delete error:", error);
    return NextResponse.json(
      { error: "Greška pri brisanju slike" },
      { status: 500 }
    );
  }
}
