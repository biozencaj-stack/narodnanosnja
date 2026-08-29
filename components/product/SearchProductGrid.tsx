'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import type { ProductCard as ProductCardType } from '@/types/product';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchProductGridProps {
  products: ProductCardType[];
  itemsPerPage?: number;
}

export function SearchProductGrid({
  products,
  itemsPerPage = 12 // 2 rows x 6 columns
}: SearchProductGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(products.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  // Reset to page 1 when products change
  useEffect(() => {
    setCurrentPage(1);
  }, [products]);

  if (products.length === 0) {
    return null;
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of grid
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Horizontal scrollable grid - 2 rows */}
      <div className="overflow-x-auto scrollbar-hide pb-4">
        <div className="grid grid-rows-2 grid-flow-col gap-4 min-w-max">
          {currentProducts.map((product) => (
            <div key={product.id} className="w-[200px] sm:w-[220px] md:w-[250px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Previous button */}
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={cn(
                'p-2 rounded-full border border-border transition-colors',
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-primary hover:text-white hover:border-primary'
              )}
              aria-label="Prethodna stranica"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Page numbers */}
            <div className="flex gap-1">
              {getPageNumbers().map((page, index) => (
                typeof page === 'number' ? (
                  <button
                    key={index}
                    onClick={() => goToPage(page)}
                    className={cn(
                      'min-w-[40px] h-10 rounded-lg font-medium transition-colors',
                      currentPage === page
                        ? 'bg-primary text-white'
                        : 'bg-background-alt text-text hover:bg-primary-light'
                    )}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={index} className="min-w-[40px] h-10 flex items-center justify-center text-text-muted">
                    {page}
                  </span>
                )
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={cn(
                'p-2 rounded-full border border-border transition-colors',
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-primary hover:text-white hover:border-primary'
              )}
              aria-label="Sledeća stranica"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-text-muted">
            Stranica {currentPage} od {totalPages} ({products.length} proizvoda)
          </p>
        </div>
      )}
    </div>
  );
}
