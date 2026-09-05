import type { Prisma } from "@prisma/client";

/**
 * Sklapanje uslova pretrage kataloga.
 *
 * Izdvojeno iz `lib/products.ts` iz dva razloga. Prvi: taj fajl ima
 * `"use server"` na prvoj liniji, pa svaki njegov izvoz mora biti asinhrona
 * funkcija — čista funkcija tamo ne može da živi. Drugi: `npm test` glob-uje
 * isključivo `lib/**\/*.test.ts`, pa se logika koja se testira mora izdvojiti
 * iz funkcije koja odmah zove bazu.
 */

export interface ProductFilterOptions {
  categorySlug?: string;
  brandSlug?: string;
  brandIds?: string[]; // For FilterSidebar compatibility (resolved to slugs)
  gender?: string;
  onSale?: boolean;
  novo?: boolean;
  featured?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  maxPriceOnly?: number; // Alias for maxPrice (FilterSidebar uses priceMax)
  sizes?: string[];
  colors?: string[];
  types?: string[]; // Category slugs for footwear type (CIPELE -> cipele, etc.)
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export type ProductSort = "price_asc" | "price_desc" | "newest" | "name";

/** Nazivi pola iz filter trake ne poklapaju se sa vrednostima u bazi. */
const POL_U_BAZI: Record<string, string> = {
  muske: "muski",
  zenske: "zenski",
};

/**
 * Pravi `where` za katalog.
 *
 * Svaki uslov koji je sam po sebi „bilo koje od“ ide kao ZASEBAN unos u `AND`,
 * a nikad direktno u `where.OR`. Ranije su i kategorija i pojam pretrage pisali
 * u isto polje `where.OR`, pa je pretraga bez ijedne poruke brisala filter po
 * kategoriji: `/category/salovi?q=vuna` vraćao je pogotke iz celog kataloga.
 * Sa `AND` se uslovi presecaju, a svaki od njih zasebno daje isti rezultat kao
 * pre.
 */
export function buildProductWhere(
  options: ProductFilterOptions = {},
): Prisma.ProductWhereInput {
  const {
    categorySlug,
    brandSlug,
    brandIds,
    gender,
    onSale,
    novo,
    featured,
    search,
    minPrice,
    maxPrice,
    maxPriceOnly,
    sizes,
    colors,
    types,
  } = options;

  const where: Prisma.ProductWhereInput = { active: true };
  const grupe: Prisma.ProductWhereInput[] = [];

  if (categorySlug && !types?.length) {
    grupe.push({
      OR: [
        { category: { slug: categorySlug } },
        { categories: { some: { category: { slug: categorySlug } } } },
      ],
    });
  }

  if (brandSlug) {
    where.brand = { slug: brandSlug };
  }
  if (brandIds && brandIds.length > 0) {
    where.brandId = { in: brandIds };
  }
  if (gender) {
    where.gender = POL_U_BAZI[gender] || gender;
  }
  if (onSale) {
    where.onSale = true;
  }
  if (featured) {
    where.featured = true;
  }
  if (novo) {
    where.novo = true;
  }

  if (search) {
    grupe.push({
      OR: [
        { name: { path: ["sr"], string_contains: search } },
        { name: { path: ["en"], string_contains: search } },
        { description: { path: ["sr"], string_contains: search } },
        { description: { path: ["en"], string_contains: search } },
        { sku: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const gornjaCena = maxPrice ?? maxPriceOnly;
  if (minPrice !== undefined) {
    where.price = { ...((where.price as object) || {}), gte: minPrice };
  }
  if (gornjaCena !== undefined) {
    where.price = { ...((where.price as object) || {}), lte: gornjaCena };
  }

  if (sizes && sizes.length > 0) {
    where.sizes = {
      some: { size: { in: sizes }, stock: { gt: 0 }, active: true },
    };
  }

  if (colors && colors.length > 0) {
    grupe.push({
      OR: colors.map((boja) => ({
        color: { equals: boja, mode: "insensitive" as const },
      })),
    });
  }

  if (types && types.length > 0) {
    const slugovi = types.map((tip) => tip.toLowerCase().replace(/\s+/g, "-"));
    grupe.push({
      OR: [
        { category: { slug: { in: slugovi } } },
        { categories: { some: { category: { slug: { in: slugovi } } } } },
      ],
    });
  }

  if (grupe.length > 0) {
    where.AND = grupe;
  }

  return where;
}

export function buildProductOrderBy(
  sort: ProductSort = "newest",
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "name":
      return { name: "asc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}
