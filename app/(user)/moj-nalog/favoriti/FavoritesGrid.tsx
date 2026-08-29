"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toImageDataUri } from "@/lib/utils/image";
import { formatPriceWithCurrency, clearProductSufix } from "@/lib/utils/format";
import { useWishlistStore } from "@/store";
import type { ProductCard } from "@/types/product";

interface FavoritesGridProps {
  products: ProductCard[];
}

export function FavoritesGrid({ products }: FavoritesGridProps) {
  const router = useRouter();
  const { removeItem } = useWishlistStore();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    await removeItem(productId);
    startTransition(() => {
      router.refresh();
    });
    setRemovingId(null);
  };

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Heart className="h-16 w-16 mx-auto mb-4 text-stone-300" />
        <p className="text-stone-500">Nema proizvoda za prikaz</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => {
        const { id, code, name, price, price1, price2, percent1, percent2, picture, pictureName } = product;
        const cleanName = clearProductSufix(name);
        const isRemoving = removingId === id;

        // Determine final price and discount
        let finalPrice = price;
        let oldPrice: number | null = null;
        let discountBadge: string | null = null;

        if (price2 && price2 > 0) {
          finalPrice = price2;
          oldPrice = price1 || price;
          if (percent2 && percent2 > 0) discountBadge = `-${percent2}%`;
        } else if (price1 && price1 > 0) {
          finalPrice = price1;
          oldPrice = price;
          if (percent1 && percent1 > 0) discountBadge = `-${percent1}%`;
        }

        if (!discountBadge && oldPrice && finalPrice < oldPrice) {
          const calcPercent = Math.round(((oldPrice - finalPrice) / oldPrice) * 100);
          discountBadge = `-${calcPercent}%`;
        }

        return (
          <article
            key={id}
            className={`bg-white rounded-xl shadow-sm overflow-hidden transition-opacity ${
              isRemoving ? "opacity-50" : ""
            }`}
          >
            <Link href={`/product/${id}`} className="block">
              {/* Image */}
              <div className="relative aspect-square bg-stone-50">
                {discountBadge && (
                  <div className="absolute top-3 left-3 bg-black text-white text-sm font-bold px-2 py-1 rounded z-10">
                    {discountBadge}
                  </div>
                )}

                {picture ? (
                  <Image
                    src={toImageDataUri(picture)}
                    alt={pictureName || cleanName}
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    className="object-contain p-4"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    Nema slike
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-stone-900 line-clamp-2 mb-1">
                  {cleanName}
                </h3>
                <p className="text-sm text-stone-500 mb-2">{code}</p>

                {/* Prices */}
                {price2 && price2 > 0 && price1 && price1 > 0 ? (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs line-through text-stone-400">
                      {formatPriceWithCurrency(price)}
                    </span>
                    <span className="text-sm line-through text-stone-500">
                      {formatPriceWithCurrency(price1)}
                    </span>
                    <span className="text-lg font-bold text-red-600">
                      {formatPriceWithCurrency(price2)}
                    </span>
                  </div>
                ) : oldPrice && finalPrice < oldPrice ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through text-stone-500">
                      {formatPriceWithCurrency(oldPrice)}
                    </span>
                    <span className="text-lg font-bold text-red-600">
                      {formatPriceWithCurrency(finalPrice)}
                    </span>
                  </div>
                ) : (
                  <div className="text-lg font-semibold text-stone-900">
                    {formatPriceWithCurrency(finalPrice)}
                  </div>
                )}
              </div>
            </Link>

            {/* Remove button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => handleRemove(id)}
                disabled={isRemoving || isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2
                           text-red-600 bg-red-50 rounded-lg hover:bg-red-100
                           transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isRemoving ? "Uklanjanje..." : "Ukloni iz favorita"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
