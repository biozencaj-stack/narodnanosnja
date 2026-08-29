import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";

  const where: Record<string, unknown> = {};
  if (activeOnly) {
    where.isActive = true;
    where.startDate = { lte: new Date() };
    where.endDate = { gte: new Date() };
  }

  const promotions = await prisma.promotion.findMany({
    where,
    include: {
      products: {
        include: {
          product: { select: { id: true, name: true, image1: true } },
        },
      },
      _count: { select: { usages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ promotions });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    if (!name || !type || value === undefined || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const promotion = await prisma.promotion.create({
      data: {
        name,
        description: description || null,
        type,
        value,
        minQuantity: minQuantity || null,
        minCartValue: minCartValue || null,
        maxUses: maxUses || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive ?? true,
        code: code || null,
        stackable: stackable ?? false,
        quantityTiers: quantityTiers || null,
        products: productIds?.length
          ? { create: productIds.map((pid: string) => ({ productId: pid })) }
          : undefined,
      },
      include: { products: true },
    });

    return NextResponse.json({ promotion }, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Kupon kod već postoji" },
        { status: 400 },
      );
    }
    console.error("Create promotion error:", error);
    return NextResponse.json(
      { error: "Failed to create promotion" },
      { status: 500 },
    );
  }
}
