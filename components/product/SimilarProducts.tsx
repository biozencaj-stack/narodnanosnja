'use client';

import { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DugmePauze } from '@/components/ui/DugmePauze';
import { usePauzaKarusela } from '@/hooks/usePauzaKarusela';
import { ProductCard } from './ProductCard';
import type { ProductCard as ProductCardType } from '@/types/product';
import { cn } from '@/lib/utils';

interface SimilarProductsProps {
  productCode?: string;
  gender?: string | null; // Accepts any string - API normalizes it
  title?: string;
}

export function SimilarProducts({
  productCode,
  gender,
  title = "Slični proizvodi"
}: SimilarProductsProps) {
  const [products, setProducts] = useState<ProductCardType[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', slidesToScroll: 1 },
    [Autoplay({ delay: 5000, stopOnInteraction: true })]
  );

  // Autoplay traje duže od pet sekundi, pa mora postojati vidljiv način
  // da se zaustavi. `stopOnInteraction` to ne ispunjava — staje tek kad
  // posetilac dodirne sadržaj, a kriterijum traži mehanizam i pre toga.
  const pauza = usePauzaKarusela(emblaApi);

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

  useEffect(() => {
    const fetchSimilar = async () => {
      try {
        // Pass gender directly - API will normalize it to muske/zenske
        // Default to Ž (women's) if not specified
        const genderParam = gender && gender.trim() ? gender : 'Ž';
        const url = `/api/products/similar?gender=${encodeURIComponent(genderParam)}${productCode ? `&exclude=${productCode}` : ''}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error('Error fetching similar products:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    fetchSimilar();
  }, [productCode, gender]);

  // Don't show anything until loaded
  if (!isLoaded || products.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 border-t border-border pt-12 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-display text-text">
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
          <DugmePauze
            pauzirano={pauza.pauzirano}
            onPrebaci={pauza.prebaci}
            naziv="Slični proizvodi"
          />
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
        <DugmePauze
          pauzirano={pauza.pauzirano}
          onPrebaci={pauza.prebaci}
          naziv="Slični proizvodi"
          className="p-3"
        />
      </div>
    </section>
  );
}
