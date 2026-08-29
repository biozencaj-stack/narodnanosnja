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
 * GET /api/admin/categories
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
      _count: { select: { products: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ categories });
}

/**
 * POST /api/admin/categories
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, image, parentId, active, showInNav, navOrder, sortOrder } = body;

    const nameVal =
      typeof name === "object" && name
        ? name
        : { sr: String(name || ""), en: String(name || "") };
    const nameStr = getSlugSource(nameVal);
    if (!nameStr) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let slug = slugify(nameStr);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const category = await prisma.category.create({
      data: {
        name: typeof name === "object" ? name : { sr: name, en: name },
        slug,
        description:
          typeof description === "object"
            ? description
            : description
              ? { sr: description, en: description }
              : Prisma.DbNull,
        image: image || null,
        parentId: parentId || null,
        active: active ?? true,
        showInNav: showInNav ?? false,
        navOrder: navOrder ?? 0,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 },
    );
  }
}
