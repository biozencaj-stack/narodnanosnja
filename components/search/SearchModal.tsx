'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Search, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store';
import { toImageDataUri } from '@/lib/utils/image';
import { formatPriceWithCurrency } from '@/lib/utils/format';
import { getLocalized } from '@/lib/i18n/localized';
import type { ProductCardData } from '@/lib/products';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function SearchModal() {
  const { isSearchOpen, closeSearch } = useUIStore();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const debouncedQuery = useDebounce(query, 300);

  // Focus input when modal opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isSearchOpen) {
      setQuery('');
      setResults([]);
      setTotalCount(0);
      setSearchError(null);
    }
  }, [isSearchOpen]);

  // Search products
  useEffect(() => {
    const controller = new AbortController();

    const searchProducts = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        setTotalCount(0);
        setSearchError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setSearchError(null);
      setResults([]);
      setTotalCount(0);
      try {
        const response = await fetch(
          `/api/products?search=${encodeURIComponent(debouncedQuery)}&limit=12`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const data = await response.json();
        setResults(data.products || []);
        setTotalCount(data.total ?? data.pagination?.total ?? data.products?.length ?? 0);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Search error:', error);
          setSearchError('Pretraga trenutno nije dostupna. Pokušajte ponovo.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    searchProducts();
    return () => controller.abort();
  }, [debouncedQuery, retryNonce]);

  // Scroll carousel
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      closeSearch();
      router.push(`/pretraga?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSearch();
    }
  }, [closeSearch]);

  return (
    <Dialog.Root open={isSearchOpen} onOpenChange={(open) => !open && closeSearch()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in" />

        {/* Content */}
        <Dialog.Content
          className="fixed inset-x-0 top-0 z-50 w-full animate-slide-in-up"
          onKeyDown={handleKeyDown}
        >
          {/* Accessibility: Hidden title and description for screen readers */}
          <Dialog.Title className="sr-only">Pretraga proizvoda</Dialog.Title>
          <Dialog.Description className="sr-only">
            Pretražite proizvode po imenu, brendu ili kategoriji
          </Dialog.Description>

          <div className="bg-background shadow-2xl">
            <div className="container-wide py-6">
              {/* Search form */}
              <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSearchError(null);
                      }}
                      placeholder="Pretražite proizvode..."
                      aria-label="Pretražite proizvode"
                      className="w-full h-14 pl-12 pr-4 text-lg bg-background-alt border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors"
                    />
                    {loading && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted animate-spin" />
                    )}
                  </div>

                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="p-3 text-text-muted hover:text-text transition-colors"
                      aria-label="Zatvori pretragu"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </Dialog.Close>
                </div>
              </form>

              {/* Results */}
              {query.length >= 2 && (
                <div className="mt-6">
                  {searchError ? (
                    <div
                      className="flex flex-col items-center rounded-xl border border-error/20 bg-error-light px-4 py-6 text-center"
                      role="alert"
                    >
                      <AlertCircle className="mb-2 h-6 w-6 text-error" aria-hidden="true" />
                      <p className="text-sm text-error">{searchError}</p>
                      <button
                        type="button"
                        onClick={() => setRetryNonce((value) => value + 1)}
                        className="mt-3 rounded-lg border border-error/30 bg-background px-4 py-2 text-sm font-medium text-text transition-colors hover:border-error"
                      >
                        Pokušaj ponovo
                      </button>
                    </div>
                  ) : results.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-text-muted" role="status" aria-live="polite">
                          Pronađeno {totalCount} rezultata
                        </p>
                        {/* Navigation arrows - desktop */}
                        <div className="hidden sm:flex items-center gap-2">
                          <button
                            onClick={() => scroll('left')}
                            className="p-2 rounded-full border border-border hover:bg-primary hover:text-white hover:border-primary transition-colors"
                            aria-label="Prethodno"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => scroll('right')}
                            className="p-2 rounded-full border border-border hover:bg-primary hover:text-white hover:border-primary transition-colors"
                            aria-label="Sledeće"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Horizontal scrollable carousel */}
                      <div
                        ref={scrollContainerRef}
                        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-2 px-2 snap-x snap-mandatory"
                      >
                        {results.map((product) => {
                          const cleanName = getLocalized(product.name, locale);
                          const hasDiscount = product.salePrice !== null && product.salePrice < product.price;
                          const finalPrice = hasDiscount ? product.salePrice! : product.price;
                          const discountPercent = hasDiscount
                            ? Math.round(((product.price - finalPrice) / product.price) * 100)
                            : 0;

                          return (
                            <Link
                              key={product.id}
                              href={`/product/${product.slug}`}
                              onClick={closeSearch}
                              className="group block flex-shrink-0 w-[140px] sm:w-[160px] snap-start"
                            >
                              <div className="relative aspect-square bg-background-alt rounded-lg overflow-hidden mb-2">
                                {discountPercent > 0 && (
                                  <span className="absolute bottom-1 left-1 z-10 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                                    -{discountPercent}%
                                  </span>
                                )}
                                {product.image1 ? (
                                  <Image
                                    src={toImageDataUri(product.image1)}
                                    alt={cleanName}
                                    fill
                                    sizes="160px"
                                    className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-text-light">
                                    <Search className="h-8 w-8" />
                                  </div>
                                )}
                              </div>
                              <h3 className="text-xs sm:text-sm font-medium text-text line-clamp-2 group-hover:text-primary transition-colors">
                                {cleanName}
                              </h3>
                              {hasDiscount ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs line-through text-text-muted">
                                    {formatPriceWithCurrency(product.price)}
                                  </span>
                                  <span className="text-xs sm:text-sm text-primary font-semibold">
                                    {formatPriceWithCurrency(finalPrice)}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-xs sm:text-sm text-primary font-semibold">
                                  {formatPriceWithCurrency(finalPrice)}
                                </p>
                              )}
                            </Link>
                          );
                        })}
                      </div>

                      {/* View all results */}
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => {
                            closeSearch();
                            router.push(`/pretraga?q=${encodeURIComponent(query)}`);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
                        >
                          Pogledaj sve rezultate ({totalCount})
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : !loading ? (
                    <p className="text-center text-text-muted py-8">
                      Nema rezultata za &quot;{query}&quot;
                    </p>
                  ) : null}
                </div>
              )}

              {/* Neutral guidance until search suggestions become data-driven. */}
              {query.length < 2 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-text-muted">
                    Unesite najmanje dva karaktera naziva proizvoda, kategorije ili šifre.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
