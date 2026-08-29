'use client';

import { ProductCard } from './ProductCard';
import { Pagination } from '@/components/ui/Pagination';
import type { ProductCard as ProductCardType } from '@/types/product';

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface ProductGridProps {
  products: ProductCardType[];
  pagination?: PaginationInfo;
  showPagination?: boolean;
}

export function ProductGrid({
  products,
  pagination,
  showPagination = true
}: ProductGridProps) {

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-24 h-24 mb-6 text-text-light">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-text mb-2">
          Nema proizvoda
        </h3>
        <p className="text-text-muted max-w-md">
          Nismo pronašli proizvode koji odgovaraju vašim kriterijumima.
          Pokušajte da promenite filtere.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Top Pagination */}
      {showPagination && pagination && pagination.totalPages > 1 && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
          />
          <p className="text-sm text-text-muted">
            Prikazano {((pagination.page - 1) * pagination.perPage) + 1} - {Math.min(pagination.page * pagination.perPage, pagination.total)} od {pagination.total} proizvoda
          </p>
        </div>
      )}

      {/* Products grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Bottom Pagination */}
      {showPagination && pagination && pagination.totalPages > 1 && (
        <div className="mt-12 flex flex-col items-center gap-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
          />
          <p className="text-sm text-text-muted">
            Prikazano {((pagination.page - 1) * pagination.perPage) + 1} - {Math.min(pagination.page * pagination.perPage, pagination.total)} od {pagination.total} proizvoda
          </p>
        </div>
      )}
    </>
  );
}
