import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getLocalized } from "@/lib/i18n/localized";
import {
  FilterSidebar,
  SortDropdown,
  MobileFilterButton,
  MobileFilters,
  ActiveMobileFilterChips,
  PerPageSelector,
} from "@/components/filter";
import { LocalProductCard } from "@/components/product/LocalProductCard";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { BreadcrumbJsonLd } from "@/components/seo";
import { fetchProducts, fetchBrands } from "@/lib/products";
import type { ProductCardData } from "@/lib/products";

export const metadata: Metadata = {
  title: "Katalog",
  description: "Pregledajte kompletnu ponudu proizvoda",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function ProductsSection({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = Math.max(1, parseInt(String(searchParams.page)) || 1);
  const perPage = Math.min(48, Math.max(12, parseInt(String(searchParams.perPage)) || 24));
  const sort = (searchParams.sort as "price_asc" | "price_desc" | "newest" | "name") || "newest";

  const gender = searchParams.gender as string | undefined;
  const isZenska = searchParams.gender === "zenske" || false;
  const isMuska = searchParams.gender === "muske" || false;

  const brandIds = searchParams.brand
    ? (Array.isArray(searchParams.brand) ? searchParams.brand : [searchParams.brand]).filter(Boolean)
    : undefined;

  const types = searchParams.type
    ? (Array.isArray(searchParams.type) ? searchParams.type : [searchParams.type]).filter(Boolean)
    : undefined;

  const colors = searchParams.color
    ? (Array.isArray(searchParams.color) ? searchParams.color : [searchParams.color]).filter(Boolean)
    : undefined;

  const sizes = searchParams.size
    ? (Array.isArray(searchParams.size) ? searchParams.size : [searchParams.size]).filter(Boolean)
    : undefined;

  const priceMin = searchParams.priceMin ? parseInt(String(searchParams.priceMin)) : undefined;
  const priceMax = searchParams.priceMax
    ? parseInt(String(searchParams.priceMax))
    : searchParams.price
      ? parseInt(String(searchParams.price))
      : undefined;

  const onSale = searchParams.sale === "true";
  const novo = searchParams.novo === "true";

  const genderMapped = isZenska ? "zenske" : isMuska ? "muske" : gender;

  const { products, total, totalPages } = await fetchProducts({
    gender: genderMapped,
    brandIds,
    types,
    colors,
    sizes,
    minPrice: priceMin,
    maxPrice: priceMax,
    maxPriceOnly: priceMax,
    onSale,
    novo,
    sort,
    page,
    limit: perPage,
  });

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-24 h-24 mb-6 text-text-light">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-text mb-2">Nema proizvoda</h3>
        <p className="text-text-muted max-w-md">
          Nismo pronašli proizvode koji odgovaraju vašim kriterijumima. Pokušajte da promenite filtere.
        </p>
        <Link
          href="/catalog"
          className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Obriši filtere
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-2">
        <Pagination currentPage={page} totalPages={totalPages} />
        <p className="text-sm text-text-muted">
          Prikazano {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} od {total} proizvoda
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-8 lg:grid-cols-3 lg:gap-10">
        {products.map((product: ProductCardData) => (
          <LocalProductCard key={product.id} product={product} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-12 flex flex-col items-center gap-4">
          <Pagination currentPage={page} totalPages={totalPages} />
          <p className="text-sm text-text-muted">
            Prikazano {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} od {total} proizvoda
          </p>
        </div>
      )}
    </>
  );
}

export default async function KatalogPage({ searchParams }: PageProps) {
  const search = await searchParams;
  const locale = await getLocale();
  const brands = await fetchBrands();
  const localizedBrands = brands.map((brand) => ({
    id: brand.id,
    name: getLocalized(brand.name, locale),
  }));
  const perPage = parseInt(String(search.perPage)) || 24;

  const currentGender = search.gender as string;
  const pageTitle =
    currentGender === "zenske"
      ? "Za nju"
      : currentGender === "muske"
        ? "Za njega"
        : "Svi proizvodi";

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Početna", href: "/" },
          { name: "Katalog", href: "/catalog" },
        ]}
      />

      <MobileFilters brands={localizedBrands} />

      <div className="border-b border-stone-200 bg-stone-50">
        <div className="container-wide py-5 lg:py-6">
          <nav className="flex items-center gap-2 text-sm text-stone-400 mb-3">
            <Link href="/" className="hover:text-stone-700 transition-colors">Početna</Link>
            <span>/</span>
            <span className="text-stone-700 font-medium">Katalog</span>
          </nav>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-stone-900 tracking-tight">{pageTitle}</h1>
              <p className="text-stone-500 mt-1 text-sm lg:text-base">Istražite našu kompletnu ponudu</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-wide py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          <div className="hidden lg:block lg:w-80 shrink-0">
            <div className="sticky top-24">
              <FilterSidebar
                brands={localizedBrands}
                baseUrl="/catalog"
                showGenderFilter={true}
              />
            </div>
          </div>

          <div className="flex-1 min-h-[60vh]">
            <div className="flex items-center justify-between mb-6 gap-4">
              <MobileFilterButton />
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="hidden lg:block">
                  <PerPageSelector currentPerPage={perPage} />
                </div>
                <SortDropdown />
              </div>
            </div>

            <ActiveMobileFilterChips brands={localizedBrands} />

            <Suspense fallback={<ProductGridSkeleton count={12} />}>
              <ProductsSection searchParams={search} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
