import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getStorefrontUrl } from "@/lib/config/storefront-url";
import { storeCapabilities } from "@/lib/config/capabilities";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getStorefrontUrl().toString().replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  const staticPages = [
    "", "/catalog",
    ...(storeCapabilities.storeLocations ? ["/prodajna-mesta"] : []),
    "/blog", "/contact", "/o-nama", "/uslovi-koriscenja", "/politika-privatnosti",
    "/nacin-placanja", "/uslovi-isporuke", "/pravo-na-odustanak", "/povracaj-sredstava",
    "/reklamacije",
    ...(storeCapabilities.cardPayments ? ["/placanje-karticama"] : []),
    "/zamena-proizvoda", "/uputstvo",
  ];

  for (const page of staticPages) {
    entries.push({
      url: `${siteUrl}${page}`,
      lastModified: new Date(),
      changeFrequency: page === "" ? "daily" : "weekly",
      priority: page === "" ? 1.0 : 0.7,
    });
  }

  // Product pages
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    for (const product of products) {
      entries.push({
        url: `${siteUrl}/product/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch products:", error);
  }

  // Brand pages
  try {
    const brands = await prisma.brand.findMany({
      where: { active: true },
      select: { slug: true },
    });

    for (const brand of brands) {
      entries.push({
        url: `${siteUrl}/catalog/brand/${brand.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch brands:", error);
  }

  // Category pages
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      select: { slug: true },
    });

    for (const cat of categories) {
      entries.push({
        url: `${siteUrl}/catalog?category=${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch categories:", error);
  }

  // Blog articles
  try {
    const articles = await prisma.article.findMany({
      where: { published: true },
      select: { slug: true, publishedAt: true },
    });

    for (const article of articles) {
      entries.push({
        url: `${siteUrl}/blog/${article.slug}`,
        lastModified: article.publishedAt || new Date(),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch articles:", error);
  }

  return entries;
}
