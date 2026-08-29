'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, Eye } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import type { ProductCard as ProductCardType } from '@/types/product';
import { toImageDataUri } from '@/lib/utils/image';
import { formatPriceWithCurrency, clearProductSufix } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { useWishlistStore, useQuickViewStore } from '@/store';
import { storeCapabilities } from '@/lib/config/capabilities';

interface ProductCardProps {
  product: ProductCardType;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { id, code, name, price, price1, price2, percent1, percent2, picture, pictureName } = product;
  const { data: session } = useSession();
  const { items, toggleItem, initialize, isInitialized } = useWishlistStore();
  const { openQuickView } = useQuickViewStore();

  const isInWishlist = items.includes(id);

  // Initialize wishlist when user is logged in
  useEffect(() => {
    if (storeCapabilities.wishlist && session?.user && !isInitialized) {
      initialize();
    }
  }, [session, isInitialized, initialize]);

  // Clean product name from special characters
  const cleanName = clearProductSufix(name);

  // Determine final price and discount badges (matching old project logic)
  let finalPrice = price;
  let oldPrice: number | null = null;

  // Two separate badges for dual discounts (like old project)
  let badge1: string | null = null; // First discount (akcija) - red-500
  let badge2: string | null = null; // Second discount (sezonsko) - red-800

  if (price2 && price2 > 0) {
    finalPrice = price2;
    oldPrice = price1 || price;
    // When price2 exists, show both badges if both percentages exist
    if (percent1 && percent1 > 0) badge1 = `-${percent1}%`;
    if (percent2 && percent2 > 0) badge2 = `-${percent2}%`;
  } else if (price1 && price1 > 0) {
    finalPrice = price1;
    oldPrice = price;
    if (percent1 && percent1 > 0) badge1 = `-${percent1}%`;
  }

  // Fallback calculation for percentage if not provided but prices exist
  if (!badge1 && !badge2 && oldPrice && finalPrice < oldPrice) {
    const calcPercent = Math.round(((oldPrice - finalPrice) / oldPrice) * 100);
    badge1 = `-${calcPercent}%`;
  }

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user) {
      // Redirect to login if not logged in
      window.location.href = '/login?callbackUrl=' + encodeURIComponent(window.location.pathname);
      return;
    }

    await toggleItem(id);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openQuickView(product);
  };

  return (
    <article className={cn('group relative', className)}>
      <Link href={`/product/${id}`} className="block">
        {/* Image container - with shadow and consistent aspect ratio */}
        <div className="relative aspect-square overflow-hidden rounded-md bg-white shadow-md hover:shadow-lg hover:shadow-gray-400/50 transition-all duration-300 ease-in-out">

          {/* Discount badges - two separate boxes stacked */}
          {(badge1 || badge2) && (
            <div className="absolute top-2 left-2 z-10 flex flex-col items-center gap-1">
              {badge1 && (
                <div className="bg-red-600 text-white text-sm font-bold px-2.5 py-1.5 rounded-full">
                  {badge1}
                </div>
              )}
              {badge2 && (
                <div className="bg-blue-600 text-white text-sm font-bold px-2.5 py-1.5 rounded-full">
                  {badge2}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
            {/* Wishlist button */}
            {storeCapabilities.wishlist && (
              <button
                className={cn(
                  "p-2 rounded-full backdrop-blur-sm transition-all",
                  isInWishlist
                    ? "bg-red-50 text-red-500 opacity-100"
                    : "bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
                )}
                onClick={handleWishlistClick}
                aria-label={isInWishlist ? "Ukloni iz liste želja" : "Dodaj u listu želja"}
                aria-pressed={isInWishlist}
              >
                <Heart
                  className="h-5 w-5"
                  fill={isInWishlist ? "currentColor" : "none"}
                />
              </button>
            )}

            {/* Quick View button */}
            <button
              className="p-2 rounded-full bg-white/80 text-gray-400 hover:text-primary hover:bg-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
              onClick={handleQuickView}
              aria-label="Brzi pregled"
            >
              <Eye className="h-5 w-5" />
            </button>
          </div>

          {/* Product image - with zoom on hover */}
          {picture ? (
            <Image
              src={toImageDataUri(picture)}
              alt={pictureName || cleanName}
              fill
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 280px"
              quality={75}
              loading="lazy"
              className="object-contain p-4 bg-white transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex justify-center items-center">
              <span className="text-gray-500">No Image Available</span>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="mt-6 space-y-2">
          <h3 className="text-lg text-gray-800 font-medium line-clamp-2 leading-snug" title={cleanName}>
            {cleanName}
          </h3>
          <p className="text-base text-gray-900">
            {code}
          </p>

          {/* Prices */}
          {price2 && price2 > 0 && price1 && price1 > 0 ? (
            // Dva popusta - prikaži sve 3 cene
            <div className="flex flex-wrap items-baseline gap-2 pt-2">
              <span className="text-xs line-through text-gray-900">
                {formatPriceWithCurrency(price)}
              </span>
              <span className="text-sm line-through text-gray-900">
                {formatPriceWithCurrency(price1)}
              </span>
              <span className="text-xl font-bold text-red-600">
                {formatPriceWithCurrency(price2)}
              </span>
            </div>
          ) : oldPrice && finalPrice < oldPrice ? (
            // Jedan popust - standardni prikaz
            <div className="flex items-center gap-3 pt-2">
              <span className="text-base line-through text-gray-900">
                {formatPriceWithCurrency(oldPrice)}
              </span>
              <span className="text-xl font-bold text-red-600">
                {formatPriceWithCurrency(finalPrice)}
              </span>
            </div>
          ) : (
            // Bez popusta
            <div className="text-xl font-semibold text-gray-900 pt-2">
              {formatPriceWithCurrency(finalPrice)}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
