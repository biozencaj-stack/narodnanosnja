import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/products";

/** Lista razdvojena zarezima; prazni delovi se izbacuju, ne šalju se dalje. */
function listaParametra(sirovo: string | null): string[] | undefined {
  if (!sirovo) return undefined;
  const delovi = sirovo
    .split(",")
    .map((deo) => deo.trim())
    .filter((deo) => deo.length > 0);
  return delovi.length > 0 ? delovi : undefined;
}

/**
 * Ceo broj iz upita, u granicama. `parseInt("abc")` daje `NaN`, koji bi kao
 * `skip` stigao do Prisme i oborio rutu, pa se ovde vraća podrazumevana
 * vrednost. Gornja granica postoji zato što je ruta javna: bez nje
 * `?limit=100000` naručuje ceo katalog jednim zahtevom.
 */
function ceoBroj(sirovo: string | null, podrazumevano: number, najvise: number): number {
  const broj = Number.parseInt(sirovo ?? "", 10);
  if (!Number.isFinite(broj)) return podrazumevano;
  return Math.min(Math.max(broj, 1), najvise);
}

/**
 * GET /api/products
 * Public API for fetching products with filters (used by client components)
 *
 * Prosleđuje se sve što `fetchProducts` ume da primi. Ranije su `novo`,
 * `colors`, `types` i `brandIds` postojali u filteru ali ne i ovde, pa je
 * klijentska strana imala opcije koje ruta tiho odbaci.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const options = {
    categorySlug: searchParams.get("category") || undefined,
    brandSlug: searchParams.get("brand") || undefined,
    gender: searchParams.get("gender") || undefined,
    brandIds: listaParametra(searchParams.get("brandIds")),
    onSale: searchParams.get("sale") === "true" || undefined,
    featured: searchParams.get("featured") === "true" || undefined,
    novo: searchParams.get("novo") === "true" || undefined,
    search: searchParams.get("search") || undefined,
    minPrice: searchParams.get("minPrice")
      ? Number(searchParams.get("minPrice"))
      : undefined,
    maxPrice: searchParams.get("maxPrice")
      ? Number(searchParams.get("maxPrice"))
      : undefined,
    sizes: listaParametra(searchParams.get("sizes")),
    colors: listaParametra(searchParams.get("colors")),
    types: listaParametra(searchParams.get("types")),
    sort:
      (searchParams.get("sort") as
        | "price_asc"
        | "price_desc"
        | "newest"
        | "name") || "newest",
    page: ceoBroj(searchParams.get("page"), 1, 10_000),
    limit: ceoBroj(searchParams.get("limit"), 12, 60),
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
