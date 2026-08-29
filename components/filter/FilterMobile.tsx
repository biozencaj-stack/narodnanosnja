'use client';

import { useUIStore } from '@/store';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterSidebar } from './FilterSidebar';
import { cn } from '@/lib/utils';

export function FilterMobileButton() {
  const { openMobileFilters } = useUIStore();

  return (
    <Button
      variant="secondary"
      onClick={openMobileFilters}
      className="lg:hidden"
    >
      <SlidersHorizontal className="h-4 w-4 mr-2" />
      Filteri
    </Button>
  );
}

export function FilterMobileDrawer() {
  const { isMobileFiltersOpen, closeMobileFilters } = useUIStore();

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden',
          isMobileFiltersOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMobileFilters}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-full max-w-sm bg-background shadow-xl transition-transform duration-300 ease-in-out lg:hidden',
          isMobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-border">
          <h2 className="text-lg font-semibold">Filteri</h2>
          <button
            onClick={closeMobileFilters}
            className="p-2 -mr-2 text-text hover:text-primary transition-colors"
            aria-label="Zatvori"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-8rem)] px-6 py-4">
          <FilterSidebar />
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-border bg-background">
          <Button fullWidth onClick={closeMobileFilters}>
            Prikaži rezultate
          </Button>
        </div>
      </div>
    </>
  );
}
