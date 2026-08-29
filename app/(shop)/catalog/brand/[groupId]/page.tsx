import { fetchProducts } from "@/lib/products";
import { LocalProductCard } from "@/components/product/LocalProductCard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Pagination } from "@/components/ui/Pagination";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getLocalized } from "@/lib/i18n/localized";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { groupId } = await params;
  const locale = await getLocale();
  const brand = await prisma.brand.findFirst({ where: { OR: [{ slug: groupId }, { id: groupId }] } });
  return { title: brand ? getLocalized(brand.name, locale) || "Brend" : "Brend" };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { groupId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const page = parseInt(sp.page || "1");
  const sort = (sp.sort as "price_asc" | "price_desc" | "newest" | "name") || "newest";

  const brand = await prisma.brand.findFirst({ where: { OR: [{ slug: groupId }, { id: groupId }] } });
  if (!brand) notFound();

  const { products, total, totalPages } = await fetchProducts({
    brandSlug: brand.slug,
    sort, page, limit: 12,
  });

  const brandName = getLocalized(brand.name, locale);
  const brandDesc = getLocalized(brand.description, locale);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link href="/catalog" className="text-sm text-stone-500 hover:text-stone-900 mb-4 inline-block">&larr; Katalog</Link>
      <h1 className="text-3xl font-display font-bold text-stone-900 mb-2">{brandName}</h1>
      {brandDesc && <p className="text-stone-600 mb-4">{brandDesc}</p>}
      <p className="text-stone-500 mb-6">{total} proizvoda</p>

      {products.length === 0 ? (
        <div className="text-center py-16"><p className="text-stone-500">Nema proizvoda za ovaj brend.</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => <LocalProductCard key={p.id} product={p} />)}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} className="mt-8" />
      )}
    </div>
  );
}
