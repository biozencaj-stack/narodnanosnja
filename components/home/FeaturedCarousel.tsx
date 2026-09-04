'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { DugmePauze } from '@/components/ui/DugmePauze';
import { usePauzaKarusela } from '@/hooks/usePauzaKarusela';
import { ProductCard } from '@/components/product/ProductCard';
import type { ProductCard as ProductCardType } from '@/types/product';
import { cn } from '@/lib/utils';

type GenderTab = 'zenske' | 'muske';

interface FeaturedCarouselProps {
  title?: string;
  womenProducts: ProductCardType[];
  menProducts: ProductCardType[];
  loadError?: boolean;
}

export function FeaturedCarousel({
  title = 'Akcija',
  womenProducts,
  menProducts,
  loadError = false,
}: FeaturedCarouselProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<GenderTab>('zenske');
  const [isRetrying, setIsRetrying] = useState(false);

  const products = activeTab === 'zenske' ? womenProducts : menProducts;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
      slidesToScroll: 1,
    },
    [Autoplay({ delay: 5000, stopOnInteraction: true })]
  );

  // Autoplay duži od pet sekundi mora imati vidljivu pauzu (WCAG 2.2.2).
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

  // Mount state to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  // Reset carousel when tab changes
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(0);
    }
  }, [activeTab, emblaApi]);

  const handleRetry = () => {
    setIsRetrying(true);
    router.refresh();
  };

  // Show error state with retry button
  if (loadError && (!womenProducts || womenProducts.length === 0) && (!menProducts || menProducts.length === 0)) {
    return (
      <section className="py-10 lg:py-14 bg-background-alt">
        <div className="container-wide">
          <div className="text-center">
            <h2 className="font-display text-3xl md:text-4xl text-text mb-4">
              {title}
            </h2>
            <p className="text-text-muted mb-6">
              Nismo uspeli da učitamo proizvode na akciji.
            </p>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
              {isRetrying ? 'Učitavanje...' : 'Ponovi učitavanje'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if ((!womenProducts || womenProducts.length === 0) && (!menProducts || menProducts.length === 0)) {
    return null;
  }

  const tabs: { id: GenderTab; label: string }[] = [
    { id: 'zenske', label: 'ŽENSKA' },
    { id: 'muske', label: 'MUŠKA' },
  ];

  return (
    <section className="py-10 lg:py-14 bg-background-alt">
      <div className="container-wide">
        {/* Header - Centered */}
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl text-text mb-6">
            {title}
          </h2>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'text-sm font-medium tracking-wider pb-2 transition-all border-b-2',
                  activeTab === tab.id
                    ? 'text-text border-text'
                    : 'text-text-muted border-transparent hover:text-text'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation row */}
        <div className="flex justify-end mb-4">
          {/* Navigation buttons - desktop */}
          <div className="hidden md:flex gap-2">
            <button
              onClick={scrollPrev}
              disabled={mounted ? !canScrollPrev : false}
              className={cn(
                'p-2 rounded-full border border-border transition-colors',
                !mounted || canScrollPrev
                  ? 'hover:bg-primary hover:text-white hover:border-primary'
                  : 'opacity-50 cursor-not-allowed'
              )}
              aria-label="Prethodni"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              disabled={mounted ? !canScrollNext : false}
              className={cn(
                'p-2 rounded-full border border-border transition-colors',
                !mounted || canScrollNext
                  ? 'hover:bg-primary hover:text-white hover:border-primary'
                  : 'opacity-50 cursor-not-allowed'
              )}
              aria-label="Sledeći"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <DugmePauze
              pauzirano={pauza.pauzirano}
              onPrebaci={pauza.prebaci}
              naziv="izdvojene proizvode"
            />
          </div>
        </div>

        {/* Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex -ml-4 lg:-ml-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-[280px] sm:w-[300px] lg:w-[340px] pl-4 lg:pl-6"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>

        {/* Navigation buttons - mobile */}
        <div className="flex justify-center gap-4 mt-8 md:hidden">
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
            naziv="izdvojene proizvode"
            className="p-3"
          />
        </div>
      </div>
    </section>
  );
}
