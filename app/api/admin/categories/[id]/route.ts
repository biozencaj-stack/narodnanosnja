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
    const { name, description, image, parentId, active, showInNav, navOrder, sortOrder } = body;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    let slug = existing.slug;
    const newNameStr = name !== undefined ? getSlugSource(name) : "";
    const existingNameStr = getSlugSource(existing.name);
    if (newNameStr && newNameStr !== existingNameStr) {
      slug = slugify(newNameStr);
      const slugExists = await prisma.category.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;
    }

    const category = await prisma.category.update({
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
          description:
            description
              ? typeof description === "object"
                ? description
                : { sr: description, en: description }
              : Prisma.DbNull,
        }),
        ...(image !== undefined && { image: image || null }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(active !== undefined && { active }),
        ...(showInNav !== undefined && { showInNav }),
        ...(navOrder !== undefined && { navOrder }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
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
    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${productCount} products. Move or delete products first.`,
        },
        { status: 400 },
      );
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 },
    );
  }
}
