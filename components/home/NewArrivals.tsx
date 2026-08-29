'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocalProductCard } from '@/components/product/LocalProductCard';
import type { ProductCardData } from '@/lib/products';

interface NewArrivalsProps {
  products: ProductCardData[];
  title?: string;
  subtitle?: string;
}

export function NewArrivals({
  products,
  title = 'Novo u ponudi',
  subtitle = 'Pogledajte najnovije proizvode iz naše kolekcije',
}: NewArrivalsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(':first-child')?.clientWidth || 280;
    el.scrollBy({ left: direction === 'left' ? -cardWidth - 16 : cardWidth + 16, behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  return (
    <section className="py-14 lg:py-20 bg-background">
      <div className="container-wide">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{subtitle}</p>
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-text">
              {title}
            </h2>
          </div>

          {/* Desktop arrows */}
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                'p-2.5 rounded-full border border-border transition-all',
                canScrollLeft ? 'hover:bg-background-alt text-text' : 'opacity-30 cursor-not-allowed text-text-muted'
              )}
              aria-label="Prethodni"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                'p-2.5 rounded-full border border-border transition-all',
                canScrollRight ? 'hover:bg-background-alt text-text' : 'opacity-30 cursor-not-allowed text-text-muted'
              )}
              aria-label="Sledeći"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0"
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-[70vw] sm:w-[45vw] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)] snap-start"
            >
              <LocalProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
