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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany({
    include: {
      _count: { select: { products: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ brands });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, logo, description, active, sortOrder } = body;

    const nameVal =
      typeof name === "object" && name
        ? name
        : { sr: String(name || ""), en: String(name || "") };
    const nameStr = getSlugSource(nameVal);
    if (!nameStr) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let slug = slugify(nameStr);
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const brand = await prisma.brand.create({
      data: {
        name: typeof name === "object" ? name : { sr: name, en: name },
        slug,
        logo: logo || null,
        description:
          typeof description === "object"
            ? description
            : description
              ? { sr: description, en: description }
              : Prisma.DbNull,
        active: active ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    console.error("Create brand error:", error);
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 },
    );
  }
}
