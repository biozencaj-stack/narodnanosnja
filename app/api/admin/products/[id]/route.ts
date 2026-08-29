import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, Prisma } from "@/lib/db";
import { getSlugSource } from "@/lib/i18n/localized";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/[šś]/g, "s")
    .replace(/[žź]/g, "z")
    .replace(/đ/g, "dj")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * GET /api/admin/products/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      brand: true,
      sizes: { orderBy: { size: "asc" } },
      categories: { select: { categoryId: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const categoryIds = product.categories.map((c) => c.categoryId);
  return NextResponse.json({ product: { ...product, categoryIds } });
}

/**
 * PUT /api/admin/products/[id]
 */
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
      sku,
      price,
      salePrice,
      image1,
      image2,
      image3,
      categoryId,
      categoryIds,
      brandId,
      gender,
      active,
      featured,
      onSale,
      novo,
      metaTitle,
      metaDescription,
      sizes,
      // Universal attributes
      color,
      colorHex,
      material,
      weight,
      length,
      width,
      height,
      countryOfOrigin,
      careInstructions,
      barcode,
      tags,
    } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Update slug if name changed
    let slug = existing.slug;
    const newNameStr = name !== undefined ? getSlugSource(name) : "";
    const existingNameStr = getSlugSource(existing.name);
    if (newNameStr && newNameStr !== existingNameStr) {
      slug = slugify(newNameStr);
      const slugExists = await prisma.product.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
    }

    // Update sizes if provided
    if (sizes !== undefined) {
      // Delete existing sizes and recreate
      await prisma.productSize.deleteMany({ where: { productId: id } });
      if (sizes.length > 0) {
        await prisma.productSize.createMany({
          data: sizes.map((s: { size: string; stock: number }) => ({
            productId: id,
            size: s.size,
            stock: s.stock || 0,
          })),
        });
      }
    }

    const toJson = (v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
      typeof v === "object" && v && "sr" in (v as object)
        ? (v as Prisma.InputJsonValue)
        : typeof v === "string" && v
          ? { sr: v, en: v }
          : Prisma.DbNull;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && {
          name:
            typeof name === "object" && name
              ? { sr: (name as { sr?: string }).sr ?? "", en: (name as { en?: string }).en ?? "" }
              : { sr: String(name || ""), en: String(name || "") },
        }),
        slug,
        ...(description !== undefined && {
          description: description ? toJson(description) : Prisma.DbNull,
        }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(price !== undefined && { price }),
        ...(salePrice !== undefined && { salePrice: salePrice || null }),
        ...(image1 !== undefined && { image1: image1 || null }),
        ...(image2 !== undefined && { image2: image2 || null }),
        ...(image3 !== undefined && { image3: image3 || null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(brandId !== undefined && { brandId: brandId || null }),
        ...(gender !== undefined && { gender: gender || null }),
        ...(active !== undefined && { active }),
        ...(featured !== undefined && { featured }),
        ...(onSale !== undefined && { onSale }),
        ...(novo !== undefined && { novo }),
        ...(metaTitle !== undefined && {
          metaTitle: metaTitle ? toJson(metaTitle) : Prisma.DbNull,
        }),
        ...(metaDescription !== undefined && {
          metaDescription: metaDescription ? toJson(metaDescription) : Prisma.DbNull,
        }),
        ...(color !== undefined && { color: color || null }),
        ...(colorHex !== undefined && { colorHex: colorHex || null }),
        ...(material !== undefined && { material: material || null }),
        ...(weight !== undefined && { weight: weight || null }),
        ...(length !== undefined && { length: length || null }),
        ...(width !== undefined && { width: width || null }),
        ...(height !== undefined && { height: height || null }),
        ...(countryOfOrigin !== undefined && {
          countryOfOrigin: countryOfOrigin || null,
        }),
        ...(careInstructions !== undefined && {
          careInstructions: careInstructions ? toJson(careInstructions) : Prisma.DbNull,
        }),
        ...(barcode !== undefined && { barcode: barcode || null }),
        ...(tags !== undefined && { tags }),
      },
      include: {
        category: true,
        brand: true,
        sizes: true,
      },
    });

    // Sync multi-category associations
    if (categoryIds !== undefined) {
      await prisma.productCategory.deleteMany({ where: { productId: id } });
      const catIds: string[] = categoryIds || (categoryId ? [categoryId] : []);
      if (catIds.length > 0) {
        await prisma.productCategory.createMany({
          data: catIds.map((cId: string) => ({
            productId: id,
            categoryId: cId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/products/[id]
 */
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
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 },
    );
  }
}
