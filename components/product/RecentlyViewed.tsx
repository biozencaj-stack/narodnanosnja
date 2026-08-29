'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { ProductCard } from './ProductCard';
import type { ProductCard as ProductCardType } from '@/types/product';
import { cn } from '@/lib/utils';

interface RecentlyViewedProps {
  excludeId?: string;
  title?: string;
  maxItems?: number;
}

export function RecentlyViewed({
  excludeId,
  title = "Nedavno pregledano",
  maxItems = 10
}: RecentlyViewedProps) {
  const { items, isLoaded, getItemsExcluding } = useRecentlyViewed();

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', slidesToScroll: 1 },
    [Autoplay({ delay: 5000, stopOnInteraction: true })]
  );

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  if (!isLoaded) {
    return null;
  }

  // Get items, excluding current product if provided
  const displayItems = excludeId
    ? getItemsExcluding(excludeId).slice(0, maxItems)
    : items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return null;
  }

  // Map to ProductCard format
  const products: ProductCardType[] = displayItems.map(item => ({
    id: item.id,
    code: item.code,
    name: item.name,
    price: item.price,
    price1: item.price1,
    price2: item.price2,
    percent1: item.percent1,
    percent2: item.percent2,
    picture: item.picture,
  }));

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-display text-text">
          {title}
        </h2>
        <div className="hidden md:flex gap-2">
          <button
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className={cn(
              'p-2 rounded-full border border-border transition-colors',
              canScrollPrev ? 'hover:bg-primary hover:text-white hover:border-primary' : 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Prethodni"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!canScrollNext}
            className={cn(
              'p-2 rounded-full border border-border transition-colors',
              canScrollNext ? 'hover:bg-primary hover:text-white hover:border-primary' : 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Sledeći"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="shrink-0 w-[60vw] sm:w-1/2 md:w-1/4 lg:w-1/5 xl:w-1/6 pl-4"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="flex justify-center gap-4 mt-6 md:hidden">
        <button
          onClick={scrollPrev}
          className="p-3 rounded-full border border-border hover:bg-primary hover:text-white hover:border-primary transition-colors"
          aria-label="Prethodni"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={scrollNext}
          className="p-3 rounded-full border border-border hover:bg-primary hover:text-white hover:border-primary transition-colors"
          aria-label="Sledeći"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
