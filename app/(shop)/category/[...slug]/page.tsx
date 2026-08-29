import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
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
import { fetchProducts, fetchBrands } from "@/lib/products";
import { prisma } from "@/lib/db";
import { getLocale } from "next-intl/server";
import { getLocalized } from "@/lib/i18n/localized";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function resolveCategory(slugs: string[]) {
  if (slugs.length === 1) {
    return prisma.category.findUnique({
      where: { slug: slugs[0], active: true },
      include: {
        children: { where: { active: true }, orderBy: { sortOrder: "asc" } },
        parent: { select: { name: true, slug: true } },
      },
    });
  }

  // Nested: e.g. /category/obuca/cipele -> find "cipele" with parent "obuca"
  const parentSlug = slugs[0];
  const childSlug = slugs[slugs.length - 1];

  const category = await prisma.category.findUnique({
    where: { slug: childSlug, active: true },
    include: {
      children: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      parent: { select: { name: true, slug: true } },
    },
  });

  if (!category || category.parent?.slug !== parentSlug) return null;
  return category;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const category = await resolveCategory(slug);
  if (!category) return { title: "Kategorija" };

  const catName = getLocalized(category.name, locale);
  const catDesc = getLocalized(category.description, locale);
  return {
    title: catName,
    description: catDesc || `Proizvodi iz kategorije ${catName}`,
  };
}

async function CategoryProducts({
  categorySlug,
  categoryPath,
  searchParams,
  locale,
}: {
  categorySlug: string;
  categoryPath: string;
  searchParams: { [key: string]: string | string[] | undefined };
  locale: string;
}) {
  const page = Math.max(1, parseInt(String(searchParams.page)) || 1);
  const perPage = Math.min(48, Math.max(12, parseInt(String(searchParams.perPage)) || 24));
  const sort = (searchParams.sort as "price_asc" | "price_desc" | "newest" | "name") || "newest";

  const brandIds = searchParams.brand
    ? (Array.isArray(searchParams.brand) ? searchParams.brand : [searchParams.brand]).filter(Boolean)
    : undefined;

  const colors = searchParams.color
    ? (Array.isArray(searchParams.color) ? searchParams.color : [searchParams.color]).filter(Boolean)
    : undefined;

  const sizes = searchParams.size
    ? (Array.isArray(searchParams.size) ? searchParams.size : [searchParams.size]).filter(Boolean)
    : undefined;

  const priceMin = searchParams.priceMin ? parseInt(String(searchParams.priceMin)) : undefined;
  const priceMax = searchParams.priceMax ? parseInt(String(searchParams.priceMax)) : undefined;
  const onSale = searchParams.sale === "true";
  const novo = searchParams.novo === "true";

  const { products, total, totalPages } = await fetchProducts({
    categorySlug,
    brandIds,
    colors,
    sizes,
    minPrice: priceMin,
    maxPrice: priceMax,
    onSale,
    novo,
    sort,
    page,
    limit: perPage,
  });

  const rawBrands = await fetchBrands();
  const brands = rawBrands.map((b) => ({ id: b.id, name: getLocalized(b.name, locale) }));

  if (products.length === 0 && page === 1) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted text-lg">Nema proizvoda u ovoj kategoriji.</p>
        <Link
          href={`/category/${categoryPath}`}
          className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Obriši filtere
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="hidden lg:block lg:w-64 shrink-0">
          <FilterSidebar brands={brands} />
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6 gap-4">
            <p className="text-sm text-text-muted">
              {total} {total === 1 ? "proizvod" : "proizvoda"}
            </p>
            <div className="flex items-center gap-3">
              <MobileFilterButton />
              <div className="hidden lg:block">
                <PerPageSelector currentPerPage={perPage} />
              </div>
              <SortDropdown />
            </div>
          </div>

          <ActiveMobileFilterChips brands={brands} />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <LocalProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </div>
      </div>

      <MobileFilters brands={brands} />
    </>
  );
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await getLocale();

  const category = await resolveCategory(slug);
  if (!category) notFound();

  const catName = getLocalized(category.name, locale);
  const catDesc = getLocalized(category.description, locale);
  const breadcrumbs = [];
  if (category.parent) {
    breadcrumbs.push({
      name: getLocalized(category.parent.name, locale),
      href: `/category/${category.parent.slug}`,
    });
  }
  breadcrumbs.push({ name: catName, href: `/category/${slug.join("/")}` });

  return (
    <div className="container-wide py-8 lg:py-12">
      {/* Breadcrumbs */}
      <nav className="mb-6 text-sm text-text-muted">
        <ol className="flex items-center gap-1.5 flex-wrap">
          <li>
            <Link href="/" className="hover:text-primary transition-colors">Početna</Link>
          </li>
          {breadcrumbs.map((bc, i) => (
            <li key={bc.href} className="flex items-center gap-1.5">
              <span className="text-border">/</span>
              {i === breadcrumbs.length - 1 ? (
                <span className="text-text font-medium">{bc.name}</span>
              ) : (
                <a href={bc.href} className="hover:text-primary transition-colors">{bc.name}</a>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-text mb-2">{catName}</h1>
        {catDesc && (
          <p className="text-text-muted max-w-2xl">{catDesc}</p>
        )}

        {/* Subcategory chips */}
        {category.children.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {category.children.map((child) => (
              <a
                key={child.id}
                href={`/category/${slug[0]}/${child.slug}`}
                className="px-4 py-2 bg-background-alt border border-border rounded-full text-sm text-text-muted
                           hover:bg-primary-light hover:text-primary hover:border-primary/20 transition-all"
              >
                {getLocalized(child.name, locale)}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Products */}
      <Suspense fallback={<ProductGridSkeleton count={8} />}>
        <CategoryProducts
          categorySlug={category.slug}
          categoryPath={slug.join("/")}
          searchParams={sp}
          locale={locale}
        />
      </Suspense>
    </div>
  );
}
