import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/products";

/**
 * GET /api/products
 * Public API for fetching products with filters (used by client components)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const options = {
    categorySlug: searchParams.get("category") || undefined,
    brandSlug: searchParams.get("brand") || undefined,
    gender: searchParams.get("gender") || undefined,
    onSale: searchParams.get("sale") === "true" || undefined,
    featured: searchParams.get("featured") === "true" || undefined,
    search: searchParams.get("search") || undefined,
    minPrice: searchParams.get("minPrice")
      ? Number(searchParams.get("minPrice"))
      : undefined,
    maxPrice: searchParams.get("maxPrice")
      ? Number(searchParams.get("maxPrice"))
      : undefined,
    sizes: searchParams.get("sizes")
      ? searchParams.get("sizes")!.split(",")
      : undefined,
    sort:
      (searchParams.get("sort") as
        | "price_asc"
        | "price_desc"
        | "newest"
        | "name") || "newest",
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "12"),
  };

  try {
    const result = await fetchProducts(options);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}
