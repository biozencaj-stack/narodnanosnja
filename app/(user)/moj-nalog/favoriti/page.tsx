import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Heart, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";
import { FavoritesGrid } from "./FavoritesGrid";
import { notFound } from "next/navigation";
import { storeCapabilities } from "@/lib/config/capabilities";

export const metadata = { title: "Favoriti | Moj Nalog" };
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 10;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function FavoritesPage({ searchParams }: PageProps) {
  if (!storeCapabilities.wishlist) notFound();

  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const currentPage = parseInt(params.page || "1");

  if (!session?.user?.id) return null;

  const totalItems = await prisma.wishlist.count({
    where: { userId: session.user.id },
  });

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const wishlistItems = await prisma.wishlist.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        select: {
          id: true, slug: true, name: true,
          price: true, salePrice: true,
          image1: true, onSale: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
  });

  if (wishlistItems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Favoriti</h1>
          <p className="text-stone-600 mt-1">Vaši omiljeni proizvodi</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Heart className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">Nemate omiljenih proizvoda</h2>
          <p className="text-stone-500 mb-6">Pretražite katalog i dodajte proizvode u favorite klikom na srce.</p>
          <Link href="/catalog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800">
            <ShoppingBag className="h-5 w-5" /> Pogledajte katalog
          </Link>
        </div>
      </div>
    );
  }

  // Map to format expected by FavoritesGrid
  const products = wishlistItems
    .filter((item) => item.product)
    .map((item) => ({
      id: item.product!.id,
      code: item.product!.slug,
      name: String(typeof item.product!.name === 'object' && item.product!.name ? (item.product!.name as Record<string, string>).sr || '' : item.product!.name || ''),
      price: Number(item.product!.price),
      price1: item.product!.salePrice ? Number(item.product!.salePrice) : undefined,
      picture: item.product!.image1 || undefined,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Favoriti</h1>
        <p className="text-stone-600 mt-1">{totalItems} omiljenih proizvoda</p>
      </div>

      <FavoritesGrid products={products} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          {currentPage > 1 ? (
            <Link href={`/moj-nalog/favoriti?page=${currentPage - 1}`}
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-stone-50">
              <ChevronLeft className="h-4 w-4" /> Prethodna
            </Link>
          ) : <div />}
          <span className="text-sm text-stone-500">Strana {currentPage} od {totalPages}</span>
          {currentPage < totalPages ? (
            <Link href={`/moj-nalog/favoriti?page=${currentPage + 1}`}
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-stone-50">
              Sledeća <ChevronRight className="h-4 w-4" />
            </Link>
          ) : <div />}
        </div>
      )}
    </div>
  );
}
