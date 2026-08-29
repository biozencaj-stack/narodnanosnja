import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/security/html";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id } });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  return NextResponse.json({ article });
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
      title,
      content,
      excerpt,
      image1,
      image2,
      image3,
      author,
      published,
      publishedAt,
      metaTitle,
      metaDescription,
    } = body;

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const safeContent =
      content === undefined ? undefined : sanitizeRichHtml(content);
    if (safeContent !== undefined && !safeContent.trim()) {
      return NextResponse.json(
        { error: "Article content cannot be empty" },
        { status: 400 },
      );
    }

    let slug = existing.slug;
    if (title && title !== existing.title) {
      slug = slugify(title);
      const slugExists = await prisma.article.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Handle publishedAt when publishing for the first time
    let finalPublishedAt = existing.publishedAt;
    if (published === true && !existing.published) {
      finalPublishedAt = publishedAt ? new Date(publishedAt) : new Date();
    } else if (published === false) {
      finalPublishedAt = null;
    }

    const article = await prisma.article.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        slug,
        ...(safeContent !== undefined && { content: safeContent }),
        ...(excerpt !== undefined && { excerpt: excerpt || null }),
        ...(image1 !== undefined && { image1: image1 || null }),
        ...(image2 !== undefined && { image2: image2 || null }),
        ...(image3 !== undefined && { image3: image3 || null }),
        ...(author !== undefined && { author: author || null }),
        ...(published !== undefined && { published }),
        publishedAt: finalPublishedAt,
        ...(metaTitle !== undefined && { metaTitle: metaTitle || null }),
        ...(metaDescription !== undefined && {
          metaDescription: metaDescription || null,
        }),
      },
    });

    return NextResponse.json({ article });
  } catch (error) {
    console.error("Update article error:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
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
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete article error:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 },
    );
  }
}
