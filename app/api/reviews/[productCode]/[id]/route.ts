import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// DELETE - Obriši recenziju
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productCode: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Morate biti prijavljeni" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Pronađi recenziju
    const review = await prisma.productReview.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Recenzija nije pronađena" },
        { status: 404 }
      );
    }

    // Proveri dozvole: samo vlasnik ili admin može obrisati
    const isOwner = review.userId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Nemate dozvolu za brisanje ove recenzije" },
        { status: 403 }
      );
    }

    // Obriši recenziju
    await prisma.productReview.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review delete error:", error);
    return NextResponse.json(
      { error: "Greška pri brisanju recenzije" },
      { status: 500 }
    );
  }
}

// PUT - Ažuriraj recenziju
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productCode: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Morate biti prijavljeni" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { rating, title, comment } = body;

    // Pronađi recenziju
    const review = await prisma.productReview.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Recenzija nije pronađena" },
        { status: 404 }
      );
    }

    // Samo vlasnik može ažurirati
    if (review.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Nemate dozvolu za izmenu ove recenzije" },
        { status: 403 }
      );
    }

    // Validacija ratinga
    if (rating && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: "Ocena mora biti između 1 i 5" },
        { status: 400 }
      );
    }

    // Ažuriraj recenziju
    const updatedReview = await prisma.productReview.update({
      where: { id },
      data: {
        ...(rating && { rating }),
        ...(title !== undefined && { title: title?.trim() || null }),
        ...(comment !== undefined && { comment: comment?.trim() || null }),
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
        id: updatedReview.id,
        rating: updatedReview.rating,
        title: updatedReview.title,
        comment: updatedReview.comment,
        verified: updatedReview.verified,
        createdAt: updatedReview.createdAt,
        user: {
          name: `${updatedReview.user.firstName} ${updatedReview.user.lastName.charAt(0)}.`,
        },
      },
    });
  } catch (error) {
    console.error("Review update error:", error);
    return NextResponse.json(
      { error: "Greška pri ažuriranju recenzije" },
      { status: 500 }
    );
  }
}
