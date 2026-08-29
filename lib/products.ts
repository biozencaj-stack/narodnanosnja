"use server";

import { prisma } from "@/lib/db";
import { getLocalized } from "@/lib/i18n/localized";
import type { Prisma } from "@prisma/client";

/**
 * Local product data layer - replaces Balans API calls
 * All products are stored in the local PostgreSQL database
 */

export interface LocalProduct {
  id: string;
  name: unknown;
  slug: string;
  description: unknown;
  sku: string | null;
  price: number;
  salePrice: number | null;
  image1: string | null;
  image2: string | null;
  image3: string | null;
  category: { id: string; name: unknown; slug: string } | null;
  brand: { id: string; name: unknown; slug: string } | null;
  gender: string | null;
  active: boolean;
  featured: boolean;
  onSale: boolean;
  novo: boolean;
  sizes: { size: string; stock: number }[];
  color: string | null;
  colorHex: string | null;
  material: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  countryOfOrigin: string | null;
  careInstructions: unknown;
  barcode: string | null;
  tags: string[];
  metaTitle: unknown;
  metaDescription: unknown;
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: unknown;
  price: number;
  salePrice: number | null;
  image1: string | null;
  image2?: string | null;
  onSale: boolean;
  novo?: boolean;
  category: { name: unknown } | null;
  brand: { name: unknown } | null;
}

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
  sort?: "price_asc" | "price_desc" | "newest" | "name";
  page?: number;
  limit?: number;
}

/**
 * Fetch products list with filtering, sorting, and pagination
 */
export async function fetchProducts(options: ProductFilterOptions = {}) {
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
    sort = "newest",
    page = 1,
    limit = 12,
  } = options;

  const where: Prisma.ProductWhereInput = {
    active: true,
  };

  if (categorySlug && !types?.length) {
    where.OR = [
      { category: { slug: categorySlug } },
      { categories: { some: { category: { slug: categorySlug } } } },
    ];
  }
  if (brandSlug) {
    where.brand = { slug: brandSlug };
  }
  if (brandIds && brandIds.length > 0) {
    where.brandId = { in: brandIds };
  }
  if (gender) {
    // Map muske/zenske from FilterSidebar to muski/zenski in DB
    const genderMap: Record<string, string> = {
      muske: "muski",
      zenske: "zenski",
    };
    where.gender = genderMap[gender] || gender;
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
    where.OR = [
      { name: { path: ["sr"], string_contains: search } },
      { name: { path: ["en"], string_contains: search } },
      { description: { path: ["sr"], string_contains: search } },
      { description: { path: ["en"], string_contains: search } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  const effectiveMaxPrice = maxPrice ?? maxPriceOnly;
  if (minPrice !== undefined) {
    where.price = { ...((where.price as object) || {}), gte: minPrice };
  }
  if (effectiveMaxPrice !== undefined) {
    where.price = { ...((where.price as object) || {}), lte: effectiveMaxPrice };
  }
  if (sizes && sizes.length > 0) {
    where.sizes = {
      some: {
        size: { in: sizes },
        stock: { gt: 0 },
        active: true,
      },
    };
  }
  if (colors && colors.length > 0) {
    const colorCondition = {
      OR: colors.map((c) => ({
        color: { equals: c, mode: "insensitive" as const },
      })),
    };
    where.AND = [...((where.AND as object[]) || []), colorCondition];
  }
  if (types && types.length > 0) {
    const typeSlugs = types.map((t) =>
      t.toLowerCase().replace(/\s+/g, "-")
    );
    const typeCondition = {
      OR: [
        { category: { slug: { in: typeSlugs } } },
        { categories: { some: { category: { slug: { in: typeSlugs } } } } },
      ],
    };
    where.AND = [...((where.AND as object[]) || []), typeCondition];
  }

  // Sort options
  let orderBy: Prisma.ProductOrderByWithRelationInput;
  switch (sort) {
    case "price_asc":
      orderBy = { price: "asc" };
      break;
    case "price_desc":
      orderBy = { price: "desc" };
      break;
    case "name":
      orderBy = { name: "asc" };
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        sizes: { where: { active: true }, orderBy: { size: "asc" } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // Map to serializable format
  const items: ProductCardData[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: Number(p.price),
    salePrice: p.salePrice ? Number(p.salePrice) : null,
    image1: p.image1,
    image2: p.image2,
    onSale: p.onSale,
    novo: p.novo,
    category: p.category ? { name: p.category.name } : null,
    brand: p.brand ? { name: p.brand.name } : null,
  }));

  return {
    products: items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Fetch single product by slug
 */
export async function fetchProductBySlug(
  slug: string,
): Promise<LocalProduct | null> {
  const product = await prisma.product.findUnique({
    where: { slug, active: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true } },
      sizes: { where: { active: true }, orderBy: { size: "asc" } },
    },
  });

  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    sku: product.sku,
    price: Number(product.price),
    salePrice: product.salePrice ? Number(product.salePrice) : null,
    image1: product.image1,
    image2: product.image2,
    image3: product.image3,
    category: product.category,
    brand: product.brand,
    gender: product.gender,
    active: product.active,
    featured: product.featured,
    onSale: product.onSale,
    novo: product.novo,
    sizes: product.sizes.map((s) => ({ size: s.size, stock: s.stock })),
    color: product.color,
    colorHex: product.colorHex,
    material: product.material,
    weight: product.weight ? Number(product.weight) : null,
    length: product.length ? Number(product.length) : null,
    width: product.width ? Number(product.width) : null,
    height: product.height ? Number(product.height) : null,
    countryOfOrigin: product.countryOfOrigin,
    careInstructions: product.careInstructions,
    barcode: product.barcode,
    tags: product.tags,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
  };
}

/**
 * Fetch product by ID
 */
export async function fetchProductById(
  id: string,
): Promise<LocalProduct | null> {
  const product = await prisma.product.findUnique({
    where: { id, active: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true } },
      sizes: { where: { active: true }, orderBy: { size: "asc" } },
    },
  });

  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    sku: product.sku,
    price: Number(product.price),
    salePrice: product.salePrice ? Number(product.salePrice) : null,
    image1: product.image1,
    image2: product.image2,
    image3: product.image3,
    category: product.category,
    brand: product.brand,
    gender: product.gender,
    active: product.active,
    featured: product.featured,
    onSale: product.onSale,
    novo: product.novo,
    sizes: product.sizes.map((s) => ({ size: s.size, stock: s.stock })),
    color: product.color,
    colorHex: product.colorHex,
    material: product.material,
    weight: product.weight ? Number(product.weight) : null,
    length: product.length ? Number(product.length) : null,
    width: product.width ? Number(product.width) : null,
    height: product.height ? Number(product.height) : null,
    countryOfOrigin: product.countryOfOrigin,
    careInstructions: product.careInstructions,
    barcode: product.barcode,
    tags: product.tags,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
  };
}

/**
 * Fetch featured products for homepage
 */
export async function fetchFeaturedProducts(limit = 8) {
  return fetchProducts({ featured: true, limit });
}

/**
 * Fetch sale products
 */
export async function fetchSaleProducts(limit = 8) {
  return fetchProducts({ onSale: true, limit });
}

/**
 * Fetch similar products (same category or brand)
 */
export async function fetchSimilarProducts(
  productId: string,
  categorySlug?: string,
  brandSlug?: string,
  limit = 6,
) {
  const where: Prisma.ProductWhereInput = {
    active: true,
    id: { not: productId },
    OR: [
      ...(categorySlug ? [{ category: { slug: categorySlug } }] : []),
      ...(brandSlug ? [{ brand: { slug: brandSlug } }] : []),
    ],
  };

  // If no category or brand, just fetch recent products
  if (!categorySlug && !brandSlug) {
    delete where.OR;
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true } },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: Number(p.price),
    salePrice: p.salePrice ? Number(p.salePrice) : null,
    image1: p.image1,
    onSale: p.onSale,
    category: p.category ? { name: p.category.name } : null,
    brand: p.brand ? { name: p.brand.name } : null,
  }));
}

/**
 * Fetch all active categories
 */
export async function fetchCategories() {
  return prisma.category.findMany({
    where: { active: true },
    include: {
      _count: { select: { products: { where: { active: true } } } },
      children: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Fetch all active brands
 */
export async function fetchBrands() {
  return prisma.brand.findMany({
    where: { active: true },
    include: {
      _count: { select: { products: { where: { active: true } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Fetch published articles
 */
export async function fetchArticles(page = 1, limit = 10) {
  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.article.count({ where: { published: true } }),
  ]);

  return {
    articles,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Fetch single article by slug
 */
export async function fetchArticleBySlug(slug: string) {
  return prisma.article.findUnique({
    where: { slug, published: true },
  });
}

/**
 * Get available filter options (for sidebar)
 */
export async function getFilterOptions() {
  const [categories, brands, sizes] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, products: { some: { active: true } } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({
      where: { active: true, products: { some: { active: true } } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.productSize.findMany({
      where: { active: true, stock: { gt: 0 }, product: { active: true } },
      select: { size: true },
      distinct: ["size"],
      orderBy: { size: "asc" },
    }),
  ]);

  return {
    categories,
    brands,
    sizes: sizes.map((s) => s.size),
  };
}

export interface FilterCounts {
  gender: Record<string, number>;
  brands: Record<string, number>;
  types: Record<string, number>;
  colors: Record<string, number>;
  sizes: Record<string, number>;
  total: number;
}

interface GetFilterCountsParams {
  gender?: string;
  brandIds?: string[];
  sizes?: string[];
  colors?: string[];
  types?: string[];
  priceMin?: number;
  priceMax?: number;
  sale?: boolean;
  novo?: boolean;
  groupId?: string;
}

function buildCountsWhere(params: GetFilterCountsParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { active: true };
  const genderMap: Record<string, string> = { muske: "muski", zenske: "zenski" };

  if (params.gender) {
    where.gender = genderMap[params.gender] || params.gender;
  }
  if (params.brandIds?.length) {
    where.brandId = { in: params.brandIds };
  }
  if (params.sizes?.length) {
    where.sizes = {
      some: { active: true, size: { in: params.sizes }, stock: { gt: 0 } },
    };
  }
  if (params.colors?.length) {
    where.AND = [
      ...((where.AND as object[]) || []),
      {
        OR: params.colors.map((c) => ({
          color: { equals: c, mode: "insensitive" as const },
        })),
      },
    ];
  }
  if (params.types?.length) {
    const typeSlugs = params.types.map((t) =>
      t.toLowerCase().replace(/\s+/g, "-")
    );
    where.category = { slug: { in: typeSlugs } };
  }
  if (params.priceMin !== undefined) {
    where.price = { ...((where.price as object) || {}), gte: params.priceMin };
  }
  if (params.priceMax !== undefined) {
    where.price = { ...((where.price as object) || {}), lte: params.priceMax };
  }
  if (params.sale) {
    where.onSale = true;
  }
  if (params.novo) {
    where.novo = true;
  }
  if (params.groupId) {
    where.brand = {
      OR: [
        { id: params.groupId },
        { slug: decodeURIComponent(params.groupId) },
      ],
    };
  }
  return where;
}

export async function getFilterCounts(
  params: GetFilterCountsParams & { locale?: string }
): Promise<FilterCounts> {
  const { locale = "sr", ...countParams } = params;
  const baseWhere = buildCountsWhere(countParams);
  const genderlessWhere = buildCountsWhere({ ...countParams, gender: undefined });
  const brandlessWhere = buildCountsWhere({ ...countParams, brandIds: undefined, groupId: undefined });
  const typelessWhere = buildCountsWhere({ ...countParams, types: undefined });

  const [
    total,
    genderCounts,
    brandCounts,
    typeCounts,
    colorCounts,
    sizeCounts,
  ] = await Promise.all([
    prisma.product.count({ where: baseWhere }),
    prisma.product.groupBy({
      by: ["gender"],
      where: genderlessWhere,
      _count: { id: true },
    }),
    prisma.product.groupBy({
      by: ["brandId"],
      where: brandlessWhere,
      _count: { id: true },
    }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: typelessWhere,
      _count: { id: true },
    }),
    prisma.product.groupBy({
      by: ["color"],
      where: baseWhere,
      _count: { id: true },
    }),
    prisma.productSize.groupBy({
      by: ["size"],
      where: {
        product: baseWhere,
        active: true,
        stock: { gt: 0 },
      },
      _count: { size: true },
    }),
  ]);

  const brands = await prisma.brand.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const categories = await prisma.category.findMany({
    where: { active: true },
    select: { id: true, slug: true, name: true },
  });

  const genderMap: Record<string, string> = { muski: "muske", zenski: "zenske" };
  const counts: FilterCounts = {
    gender: { zenske: 0, muske: 0, sve: 0 },
    brands: {},
    types: {},
    colors: {},
    sizes: {},
    total,
  };

  for (const row of genderCounts) {
    const key = row.gender ? (genderMap[row.gender] || row.gender) : "sve";
    if (key) counts.gender[key] = row._count.id;
  }
  counts.gender.sve = total;

  const brandIdToName = new Map(brands.map((b) => [b.id, getLocalized(b.name, locale)]));
  for (const row of brandCounts) {
    if (row.brandId) {
      const name = brandIdToName.get(row.brandId) || row.brandId;
      counts.brands[name] = row._count.id;
    }
  }

  const catIdToSlug = new Map(categories.map((c) => [c.id, c.slug]));
  for (const row of typeCounts) {
    if (row.categoryId) {
      const slug = catIdToSlug.get(row.categoryId) || "";
      const key = slug.replace(/-/g, " ").toUpperCase();
      if (key) counts.types[key] = row._count.id;
    }
  }

  for (const row of colorCounts) {
    if (row.color) {
      const key = row.color.toLowerCase();
      counts.colors[key] = row._count.id;
    }
  }

  for (const row of sizeCounts) {
    counts.sizes[row.size] = row._count.size;
  }

  return counts;
}
