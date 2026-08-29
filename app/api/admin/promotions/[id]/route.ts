import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const promotion = await prisma.promotion.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: {
            select: { id: true, name: true, image1: true, sku: true },
          },
        },
      },
      _count: { select: { usages: true } },
    },
  });

  if (!promotion)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ promotion });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      description,
      type,
      value,
      minQuantity,
      minCartValue,
      maxUses,
      startDate,
      endDate,
      isActive,
      code,
      stackable,
      productIds,
      quantityTiers,
    } = body;

    // Update product associations if provided
    if (productIds !== undefined) {
      await prisma.promotionProduct.deleteMany({ where: { promotionId: id } });
      if (productIds.length > 0) {
        await prisma.promotionProduct.createMany({
          data: productIds.map((pid: string) => ({
            promotionId: id,
            productId: pid,
          })),
        });
      }
    }

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(type !== undefined && { type }),
        ...(value !== undefined && { value }),
        ...(minQuantity !== undefined && { minQuantity: minQuantity || null }),
        ...(minCartValue !== undefined && {
          minCartValue: minCartValue || null,
        }),
        ...(maxUses !== undefined && { maxUses: maxUses || null }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
        ...(code !== undefined && { code: code || null }),
        ...(stackable !== undefined && { stackable }),
        ...(quantityTiers !== undefined && { quantityTiers }),
      },
      include: { products: true },
    });

    return NextResponse.json({ promotion });
  } catch (error) {
    console.error("Update promotion error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await prisma.promotion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
