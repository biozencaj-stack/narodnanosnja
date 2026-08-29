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
    const { name, logo, description, active, sortOrder } = body;

    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    let slug = existing.slug;
    if (name && name !== existing.name) {
      slug = slugify(name);
      const slugExists = await prisma.brand.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...(name !== undefined && {
          name:
            typeof name === "object" && name
              ? { sr: (name as { sr?: string }).sr ?? "", en: (name as { en?: string }).en ?? "" }
              : { sr: String(name || ""), en: String(name || "") },
        }),
        slug,
        ...(logo !== undefined && { logo: logo || null }),
        ...(description !== undefined && {
          description:
            description
              ? typeof description === "object"
                ? description
                : { sr: description, en: description }
              : Prisma.DbNull,
        }),
        ...(active !== undefined && { active }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({ brand });
  } catch (error) {
    console.error("Update brand error:", error);
    return NextResponse.json(
      { error: "Failed to update brand" },
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
    const productCount = await prisma.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete brand with ${productCount} products.` },
        { status: 400 },
      );
    }

    await prisma.brand.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete brand error:", error);
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 },
    );
  }
}
