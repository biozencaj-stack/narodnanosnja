import { fetchProducts } from "@/lib/products";
import { LocalProductCard } from "@/components/product/LocalProductCard";
import { Pagination } from "@/components/ui/Pagination";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pretraga" };
export const dynamic = "force-dynamic";

export default async function PretragaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const requestedPage = parseInt(params.page || "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  if (!query || query.length < 2) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-display font-bold text-stone-900 mb-4">Pretraga</h1>
        <p className="text-stone-500">Unesite najmanje 2 karaktera za pretragu.</p>
      </div>
    );
  }

  const { products, total, totalPages } = await fetchProducts({
    search: query,
    page,
    limit: 12,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-bold text-stone-900 mb-2">
        Rezultati pretrage: &quot;{query}&quot;
      </h1>
      <p className="text-stone-500 mb-6">{total} rezultata</p>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-500 text-lg">Nema rezultata za &quot;{query}&quot;.</p>
          <p className="text-stone-400 mt-2">Pokušajte sa drugačijim terminima pretrage.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((p) => <LocalProductCard key={p.id} product={p} />)}
          </div>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} className="mt-10" />
          )}
        </>
      )}
    </div>
  );
}
