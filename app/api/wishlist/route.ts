import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET - Get user's wishlist
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Morate biti prijavljeni' },
        { status: 401 }
      );
    }

    const wishlist = await prisma.wishlist.findMany({
      where: { userId: session.user.id },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: wishlist.map((item) => item.productId),
    });
  } catch (error) {
    console.error('Wishlist GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Greška pri učitavanju liste želja' },
      { status: 500 }
    );
  }
}

// POST - Add product to wishlist
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Morate biti prijavljeni' },
        { status: 401 }
      );
    }

    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID je obavezan' },
        { status: 400 }
      );
    }

    // Use upsert to handle duplicates gracefully
    await prisma.wishlist.upsert({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId: productId,
        },
      },
      update: {}, // No update needed if exists
      create: {
        userId: session.user.id,
        productId: productId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Proizvod dodat u listu želja',
    });
  } catch (error) {
    console.error('Wishlist POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Greška pri dodavanju u listu želja' },
      { status: 500 }
    );
  }
}

// DELETE - Remove product from wishlist
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Morate biti prijavljeni' },
        { status: 401 }
      );
    }

    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID je obavezan' },
        { status: 400 }
      );
    }

    await prisma.wishlist.deleteMany({
      where: {
        userId: session.user.id,
        productId: productId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Proizvod uklonjen iz liste želja',
    });
  } catch (error) {
    console.error('Wishlist DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Greška pri uklanjanju iz liste želja' },
      { status: 500 }
    );
  }
}
