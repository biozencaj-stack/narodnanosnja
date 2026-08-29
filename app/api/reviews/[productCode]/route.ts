import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Vraća sve recenzije za proizvod + agregiranu ocenu
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productCode: string }> }
) {
  try {
    const { productCode } = await params;

    // Dekodiranje productCode (može sadržati specijalne karaktere)
    const decodedCode = decodeURIComponent(productCode);

    // Dohvati sve recenzije za ovaj proizvod
    const reviews = await prisma.productReview.findMany({
      where: {
        productCode: {
          startsWith: decodedCode.split("-")[0], // Match po osnovnoj šifri
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Izračunaj agregiranu ocenu
    const stats = {
      count: reviews.length,
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
    };

    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      stats.average = sum / reviews.length;

      // Distribucija ocena
      reviews.forEach((r) => {
        stats.distribution[r.rating]++;
      });
    }

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verified: r.verified,
        createdAt: r.createdAt,
        user: {
          name: `${r.user.firstName} ${r.user.lastName.charAt(0)}.`,
        },
      })),
      stats,
    });
  } catch (error) {
    // Check if ProductReview table doesn't exist yet (migration not run)
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2021') {
      // Return empty results gracefully - reviews feature not available yet
      return NextResponse.json({
        reviews: [],
        stats: {
          count: 0,
          average: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      });
    }
    console.error("Reviews fetch error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju recenzija" },
      { status: 500 }
    );
  }
}

// POST - Dodaj novu recenziju
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productCode: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Morate biti prijavljeni" },
        { status: 401 }
      );
    }

    const { productCode } = await params;
    const decodedCode = decodeURIComponent(productCode);
    const baseCode = decodedCode.split("-")[0]; // Osnovna šifra proizvoda

    const body = await request.json();
    const { rating, title, comment } = body;

    // Validacija ratinga
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Ocena mora biti između 1 i 5" },
        { status: 400 }
      );
    }

    // Proveri da li je korisnik već ostavio recenziju za ovaj proizvod
    const existingReview = await prisma.productReview.findFirst({
      where: {
        productCode: {
          startsWith: baseCode,
        },
        userId: session.user.id,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "Već ste ostavili recenziju za ovaj proizvod" },
        { status: 400 }
      );
    }

    // Proveri da li je korisnik kupio ovaj proizvod
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productCode: {
          startsWith: baseCode,
        },
        order: {
          userId: session.user.id,
          status: {
            in: ["CONFIRMED", "SHIPPED"],
          },
        },
      },
    });

    if (!hasPurchased) {
      return NextResponse.json(
        { error: "Možete ostaviti recenziju samo za proizvode koje ste kupili" },
        { status: 403 }
      );
    }

    // Kreiraj recenziju
    const review = await prisma.productReview.create({
      data: {
        productCode: decodedCode,
        userId: session.user.id,
        rating,
        title: title?.trim() || null,
        comment: comment?.trim() || null,
        verified: true,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        verified: review.verified,
        createdAt: review.createdAt,
        user: {
          name: `${review.user.firstName} ${review.user.lastName.charAt(0)}.`,
        },
      },
    });
  } catch (error) {
    // Check if ProductReview table doesn't exist yet (migration not run)
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2021') {
      return NextResponse.json(
        { error: "Funkcija recenzija trenutno nije dostupna" },
        { status: 503 }
      );
    }
    console.error("Review create error:", error);
    return NextResponse.json(
      { error: "Greška pri kreiranju recenzije" },
      { status: 500 }
    );
  }
}
