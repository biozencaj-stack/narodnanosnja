import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, Prisma } from "@/lib/db";
import { getSlugSource } from "@/lib/i18n/localized";
import { sanitizeLocalizedRichText } from "@/lib/security/html";
import {
  assertActiveProductHasInventory,
  planProductSizeSync,
  ProductSizeSyncError,
  resolveDesiredProductActive,
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
 * GET /api/admin/products
 * List products with search, filtering, and pagination
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId") || undefined;
  const brandId = searchParams.get("brandId") || undefined;
  const active = searchParams.get("active");
  const featured = searchParams.get("featured");
  const onSale = searchParams.get("onSale");

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { path: ["sr"], string_contains: search } },
      { name: { path: ["en"], string_contains: search } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (active !== null && active !== undefined) where.active = active === "true";
  if (featured === "true") where.featured = true;
  if (onSale === "true") where.onSale = true;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        sizes: { where: { active: true } },
        _count: { select: { orderItems: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

/**
 * POST /api/admin/products
 * Create a new product
 */
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

    const nameVal = typeof name === "object" ? name : { sr: name || "", en: name?.en || "" };
    const nameStr = getSlugSource(nameVal);
    if (!nameStr || price === undefined) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 },
      );
    }

    const productActive = resolveDesiredProductActive(true, active);
    const sizePlan =
      sizes === undefined ? null : planProductSizeSync([], sizes);
    assertActiveProductHasInventory(
      productActive,
      sizePlan?.creates.length ?? 0,
    );

    // Generate unique slug from sr
    let slug = slugify(nameStr);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: typeof name === "object" ? name : { sr: name, en: name },
          slug,
          description:
            sanitizeLocalizedRichText(description) ?? Prisma.DbNull,
          sku: sku || null,
          price,
          salePrice: salePrice || null,
          image1: image1 || null,
          image2: image2 || null,
          image3: image3 || null,
          categoryId: categoryId || null,
          brandId: brandId || null,
          gender: gender || null,
          active: productActive,
          featured: featured ?? false,
          onSale: onSale ?? false,
          novo: novo ?? false,
          metaTitle:
            typeof metaTitle === "object"
              ? metaTitle
              : metaTitle
                ? { sr: metaTitle, en: metaTitle }
                : Prisma.DbNull,
          metaDescription:
            typeof metaDescription === "object"
              ? metaDescription
              : metaDescription
                ? { sr: metaDescription, en: metaDescription }
                : Prisma.DbNull,
          color: color || null,
          colorHex: colorHex || null,
          material: material || null,
          weight: weight || null,
          length: length || null,
          width: width || null,
          height: height || null,
          countryOfOrigin: countryOfOrigin || null,
          careInstructions:
            typeof careInstructions === "object"
              ? careInstructions
              : careInstructions
                ? { sr: careInstructions, en: careInstructions }
                : Prisma.DbNull,
          barcode: barcode || null,
          tags: tags || [],
          sizes: sizePlan?.creates.length
            ? {
                create: sizePlan.creates.map((s) => ({
                  size: s.size,
                  stock: s.stock,
                  active: s.active,
                })),
              }
            : undefined,
        },
        include: {
          category: true,
          brand: true,
          sizes: { where: { active: true } },
        },
      });

      const catIds: string[] = categoryIds || (categoryId ? [categoryId] : []);
      if (catIds.length > 0) {
        await tx.productCategory.createMany({
          data: catIds.map((cId: string) => ({
            productId: created.id,
            categoryId: cId,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductSizeSyncError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  }
}
