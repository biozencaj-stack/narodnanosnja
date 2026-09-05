import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getStorefrontUrl } from "@/lib/config/storefront-url";
import { storeCapabilities } from "@/lib/config/capabilities";
import { STATICKE_STRANICE } from "@/lib/seo/staticke-stranice";

/**
 * Mapa sajta.
 *
 * Dve stvari su ovde bile pogrešne pre faze 7 i ne smeju se vratiti:
 *
 * 1. Kategorije su izlazile kao `/catalog?category=<slug>`. Katalog taj
 *    parametar NIKAD nije čitao, pa je svaka takva adresa vraćala ceo katalog —
 *    desetine duplikata iste stranice u indeksu, dok prave adrese
 *    `/category/<slug>` u mapi nisu ni postojale.
 * 2. Svaka statička stranica je nosila `lastModified: new Date()`, pa je pri
 *    svakom čitanju mape tvrdila da se upravo promenila. Datum koji uvek laže
 *    isti je kao datum kog nema, samo skuplji.
 *
 * Spisak statičkih stranica stoji u `lib/seo/staticke-stranice.ts`, da bi test
 * mogao da ga uporedi sa stvarnim rutama pod `app/`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getStorefrontUrl().toString().replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = [];

  for (const stranica of STATICKE_STRANICE) {
    if (stranica.capability && !storeCapabilities[stranica.capability]) continue;
    entries.push({
      url: `${siteUrl}${stranica.putanja}`,
      changeFrequency: stranica.putanja === "" ? "daily" : "weekly",
      priority: stranica.putanja === "" ? 1.0 : 0.7,
    });
  }

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

  try {
    const brands = await prisma.brand.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    });

    for (const brand of brands) {
      entries.push({
        url: `${siteUrl}/catalog/brand/${brand.slug}`,
        lastModified: brand.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch brands:", error);
  }

  try {
    // Ruta je `app/(shop)/category/[...slug]`. Podkategorija se otvara SAMO kao
    // `<roditelj>/<dete>`: `resolveCategory` proverava da prvi segment zaista
    // bude roditelj, pa dete upisano samostalno vraća 404.
    const categories = await prisma.category.findMany({
      where: { active: true },
      select: {
        slug: true,
        updatedAt: true,
        parent: { select: { slug: true, active: true } },
      },
    });

    for (const cat of categories) {
      if (cat.parent && !cat.parent.active) continue;
      const putanja = cat.parent ? `${cat.parent.slug}/${cat.slug}` : cat.slug;
      entries.push({
        url: `${siteUrl}/category/${putanja}`,
        lastModified: cat.updatedAt,
        changeFrequency: "weekly",
        priority: cat.parent ? 0.6 : 0.7,
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch categories:", error);
  }

  try {
    const articles = await prisma.article.findMany({
      where: { published: true },
      select: { slug: true, publishedAt: true, updatedAt: true },
    });

    for (const article of articles) {
      entries.push({
        url: `${siteUrl}/blog/${article.slug}`,
        lastModified: article.publishedAt ?? article.updatedAt,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch articles:", error);
  }

  return entries;
}
