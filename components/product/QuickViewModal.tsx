'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { useQuickViewStore } from '@/store/quickView';
import { toImageDataUri } from '@/lib/utils/image';
import { formatPriceWithCurrency, clearProductSufix } from '@/lib/utils/format';

export function QuickViewModal() {
  const { isOpen, product, closeQuickView } = useQuickViewStore();

  if (!product) return null;

  const { id, code, name, price, price1, price2, percent1, percent2, picture, pictureName } = product;

  // Determine prices and discount badges (matching ProductCard logic)
  let currentPrice = price;
  let middlePrice: number | null = null; // price1 when both discounts exist
  let originalPrice: number | null = null;

  // Two separate badges for dual discounts
  let badge1: string | null = null; // First discount (akcija) - red-500
  let badge2: string | null = null; // Second discount (sezonsko) - red-800

  if (price2 && price2 > 0 && price2 < price) {
    currentPrice = price2;
    originalPrice = price;
    if (price1 && price1 > 0 && price1 < price) {
      middlePrice = price1;
    }
    // When price2 exists, show both badges if both percentages exist
    if (percent1 && percent1 > 0) badge1 = `-${percent1}%`;
    if (percent2 && percent2 > 0) badge2 = `-${percent2}%`;
  } else if (price1 && price1 > 0 && price1 < price) {
    currentPrice = price1;
    originalPrice = price;
    if (percent1 && percent1 > 0) badge1 = `-${percent1}%`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeQuickView()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative aspect-square bg-white">
            {picture ? (
              <Image
                src={toImageDataUri(picture)}
                alt={pictureName || name}
                fill
                className="object-contain p-6"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                Nema slike
              </div>
            )}

            {/* Discount badges - two separate boxes stacked */}
            {(badge1 || badge2) && (
              <div className="absolute top-4 left-4 flex flex-col items-center gap-1">
                {badge1 && (
                  <div className="bg-red-600 text-white text-base font-bold px-3.5 py-1.5 rounded-full">
                    {badge1}
                  </div>
                )}
                {badge2 && (
                  <div className="bg-blue-600 text-white text-base font-bold px-3.5 py-1.5 rounded-full">
                    {badge2}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col justify-center space-y-4">
            <DialogTitle className="font-display text-xl text-text">
              {clearProductSufix(name)}
            </DialogTitle>

            <p className="text-sm text-text-muted">{code}</p>

            {/* Price */}
            <div className="space-y-1">
              {middlePrice ? (
                // Dva popusta - prikaži sve 3 cene
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm text-text-muted line-through">
                    {formatPriceWithCurrency(originalPrice!)}
                  </span>
                  <span className="text-base text-text-muted line-through">
                    {formatPriceWithCurrency(middlePrice)}
                  </span>
                  <span className="text-2xl font-semibold text-error">
                    {formatPriceWithCurrency(currentPrice)}
                  </span>
                </div>
              ) : originalPrice ? (
                // Jedan popust
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-semibold text-error">
                    {formatPriceWithCurrency(currentPrice)}
                  </span>
                  <span className="text-base text-text-muted line-through">
                    {formatPriceWithCurrency(originalPrice)}
                  </span>
                </div>
              ) : (
                // Bez popusta
                <span className="text-2xl font-semibold text-text">
                  {formatPriceWithCurrency(currentPrice)}
                </span>
              )}
            </div>

            {/* CTA - View Product Page */}
            <Link
              href={`/product/${id}`}
              onClick={closeQuickView}
              className="flex items-center justify-center gap-2 w-full py-3 px-6
                       bg-primary text-white rounded-lg font-medium
                       hover:bg-primary-hover transition-colors mt-4"
            >
              Pogledaj proizvod
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
