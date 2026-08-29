import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, Prisma } from "@/lib/db";
import { getSlugSource } from "@/lib/i18n/localized";
import {
  assertActiveProductHasInventory,
  lockProductInventory,
  ProductSizeSyncError,
  resolveDesiredProductActive,
  syncProductSizes,
} from "@/lib/inventory/product-size-sync";

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
      sizes: { where: { active: true }, orderBy: { size: "asc" } },
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

    const toJson = (v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
      typeof v === "object" && v && "sr" in (v as object)
        ? (v as Prisma.InputJsonValue)
        : typeof v === "string" && v
          ? { sr: v, en: v }
          : Prisma.DbNull;

    const product = await prisma.$transaction(async (tx) => {
      // Lock, size sync, inventory invariant i svi ostali upisi pripadaju istoj
      // transakciji: neuspešna validacija nikada ne ostavlja polovičnu izmenu.
      await lockProductInventory(tx, id);
      const existing = await tx.product.findUniqueOrThrow({ where: { id } });
      const desiredActive = resolveDesiredProductActive(existing.active, active);

      let slug = existing.slug;
      const newNameStr = name !== undefined ? getSlugSource(name) : "";
      const existingNameStr = getSlugSource(existing.name);
      if (newNameStr && newNameStr !== existingNameStr) {
        slug = slugify(newNameStr);
        const slugExists = await tx.product.findFirst({
          where: { slug, id: { not: id } },
        });
        if (slugExists) {
          slug = `${slug}-${Date.now().toString(36)}`;
        }
      }

      if (sizes !== undefined) {
        await syncProductSizes(tx, id, sizes);
      }

      const activeSizeCount = await tx.productSize.count({
        where: { productId: id, active: true },
      });
      assertActiveProductHasInventory(desiredActive, activeSizeCount);

      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined && {
            name:
              typeof name === "object" && name
                ? {
                    sr: (name as { sr?: string }).sr ?? "",
                    en: (name as { en?: string }).en ?? "",
                  }
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
            metaDescription: metaDescription
              ? toJson(metaDescription)
              : Prisma.DbNull,
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
            careInstructions: careInstructions
              ? toJson(careInstructions)
              : Prisma.DbNull,
          }),
          ...(barcode !== undefined && { barcode: barcode || null }),
          ...(tags !== undefined && { tags }),
        },
        include: {
          category: true,
          brand: true,
          sizes: { where: { active: true }, orderBy: { size: "asc" } },
        },
      });

      if (categoryIds !== undefined) {
        await tx.productCategory.deleteMany({ where: { productId: id } });
        const catIds: string[] =
          categoryIds || (categoryId ? [categoryId] : []);
        if (catIds.length > 0) {
          await tx.productCategory.createMany({
            data: catIds.map((cId: string) => ({
              productId: id,
              categoryId: cId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof ProductSizeSyncError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
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
    // Proizvod ostaje kao istorijski zapis: fizičko brisanje bi kaskadno
    // obrisalo ProductSize ID-jeve koje aktivne porudžbine koriste za tačno
    // vraćanje zalihe. Postojeći active flag je bezbedna arhiva i reverzibilan
    // admin tok.
    await prisma.product.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 },
    );
  }
}
