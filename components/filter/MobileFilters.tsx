'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useFilterCounts } from '@/lib/hooks';

interface Brand {
  id: string;
  name: string;
}

interface MobileFiltersProps {
  brands?: { id: string; name: string }[];
}

// Filter options - customize per store
const SIZE_OPTIONS = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL',
  '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47',
];

const COLOR_OPTIONS = [
  { value: 'crna', label: 'Crna', class: 'bg-black' },
  { value: 'bela', label: 'Bela', class: 'bg-white border border-border' },
  { value: 'braon', label: 'Braon', class: 'bg-amber-800' },
  { value: 'bez', label: 'Bež', class: 'bg-amber-100' },
  { value: 'siva', label: 'Siva', class: 'bg-gray-400' },
  { value: 'plava', label: 'Plava', class: 'bg-blue-500' },
  { value: 'crvena', label: 'Crvena', class: 'bg-red-500' },
];

// Product types - loaded dynamically from categories in the database
const PRODUCT_TYPES: { value: string; label: string }[] = [];

const PRICE_RANGES = [
  { value: '3000', label: 'Do 3.000 RSD' },
  { value: '5000', label: 'Do 5.000 RSD' },
  { value: '10000', label: 'Do 10.000 RSD' },
  { value: '20000', label: 'Do 20.000 RSD' },
];

const GENDER_OPTIONS = [
  { value: 'muske', label: 'Muški' },
  { value: 'zenske', label: 'Ženski' },
];

export function MobileFilters({ brands: initialBrands }: MobileFiltersProps = {}) {
  const { isMobileFiltersOpen, closeMobileFilters } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for filters
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<string>('');
  const [muskiChecked, setMuskiChecked] = useState(false);
  const [zenskiChecked, setZenskiChecked] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [onNovo, setOnNovo] = useState(false);

  // Brands list - use initial from props or fetch
  const [brands, setBrands] = useState<Brand[]>(
    initialBrands?.map((b) => ({ id: b.id, name: b.name })) ?? []
  );
  const [loadingBrands, setLoadingBrands] = useState(!initialBrands);

  // Sync brands when provided via props (e.g. on category navigation)
  useEffect(() => {
    if (initialBrands?.length) {
      setBrands(initialBrands.map((b) => ({ id: b.id, name: b.name })));
      setLoadingBrands(false);
    }
  }, [initialBrands]);

  // Fetch brands on mount only when not provided via props
  useEffect(() => {
    if (initialBrands) return;
    const fetchBrands = async () => {
      try {
        const response = await fetch('/api/brands');
        if (response.ok) {
          const data = await response.json();
          setBrands(Array.isArray(data) ? data : data.brands || []);
        }
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      } finally {
        setLoadingBrands(false);
      }
    };
    fetchBrands();
  }, []);

  // Get filter counts
  const { counts, loading: countsLoading } = useFilterCounts({});

  // Initialize from URL - standardized params only
  useEffect(() => {
    const sizes = searchParams.getAll('size');
    const colors = searchParams.getAll('color');
    const types = searchParams.getAll('type');
    const brandsParam = searchParams.getAll('brand');
    const price = searchParams.get('priceMax') || '';
    const sale = searchParams.get('sale') === 'true';
    const novo = searchParams.get('novo') === 'true';

    const currentGender = searchParams.get('gender') || '';
    const isZenskaPath = currentGender === 'zenske';
    const isMuskaPath = currentGender === 'muske';

    setSelectedSizes(sizes);
    setSelectedColors(colors);
    setSelectedTypes(types);
    setSelectedBrands(brandsParam);
    setSelectedPrice(price);
    setMuskiChecked(isMuskaPath);
    setZenskiChecked(isZenskaPath);
    setOnSale(sale);
    setOnNovo(novo);
  }, [searchParams]);

  // Standardized param names
  const paramNames = { color: 'color', type: 'type', sale: 'sale', novo: 'novo', price: 'priceMax' };

  // Apply filters
  const applyFilters = () => {
    // Preserve navigation state such as sort/perPage/search and keep the user
    // inside the current category. Only replace values owned by this drawer.
    const params = new URLSearchParams(searchParams.toString());
    ['size', 'color', 'type', 'brand', 'price', 'priceMax', 'sale', 'novo', 'gender', 'page'].forEach(
      (key) => params.delete(key),
    );

    selectedSizes.forEach(s => params.append('size', s));
    selectedColors.forEach(c => params.append('color', c));
    selectedTypes.forEach(t => params.append('type', t));
    selectedBrands.forEach(b => params.append('brand', b));
    if (selectedPrice) params.set('priceMax', selectedPrice);
    if (onSale) params.set('sale', 'true');
    if (onNovo) params.set('novo', 'true');

    if (muskiChecked && !zenskiChecked) {
      params.set('gender', 'muske');
    } else if (zenskiChecked && !muskiChecked) {
      params.set('gender', 'zenske');
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    closeMobileFilters();
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedSizes([]);
    setSelectedColors([]);
    setSelectedTypes([]);
    setSelectedBrands([]);
    setSelectedPrice('');
    setMuskiChecked(false);
    setZenskiChecked(false);
    setOnSale(false);
    setOnNovo(false);
  };

  // Count checked genders
  const genderCount = (muskiChecked ? 1 : 0) + (zenskiChecked ? 1 : 0);
  const activeFiltersCount = selectedSizes.length + selectedColors.length +
    selectedTypes.length + selectedBrands.length + (selectedPrice ? 1 : 0) +
    genderCount + (onSale ? 1 : 0) + (onNovo ? 1 : 0);

  return (
    <Dialog.Root open={isMobileFiltersOpen} onOpenChange={(open) => !open && closeMobileFilters()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-background shadow-xl animate-slide-in-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-border">
            <Dialog.Title className="font-display text-lg text-text">
              Filteri
              {activeFiltersCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Izaberite filtere za pretragu proizvoda
            </Dialog.Description>
            <Dialog.Close asChild>
              <button className="p-2 text-text-muted hover:text-text transition-colors">
                <X className="h-6 w-6" />
              </button>
            </Dialog.Close>
          </div>

          {/* Filters */}
          <div className="overflow-y-auto h-[calc(100%-8rem)] p-4">
            <Accordion.Root type="multiple" defaultValue={['gender', 'sale']} className="space-y-2">
              {/* Gender - Checkbox based */}
              <Accordion.Item value="gender" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Pol
                  {genderCount > 0 && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      {genderCount}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  <div className="space-y-2">
                    {GENDER_OPTIONS.map((option) => {
                      const count = counts?.gender?.[option.value];
                      const isDisabled = count === 0;
                      const isChecked = option.value === 'muske' ? muskiChecked : zenskiChecked;

                      return (
                        <label
                          key={option.value}
                          className={cn(
                            "flex items-center justify-between gap-3",
                            isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isDisabled) return;
                                // Exclusive selection: clicking one unchecks the other
                                if (option.value === 'muske') {
                                  if (muskiChecked) {
                                    // Uncheck muski → katalog
                                    setMuskiChecked(false);
                                  } else {
                                    // Check muski → uncheck zenski
                                    setMuskiChecked(true);
                                    setZenskiChecked(false);
                                  }
                                } else {
                                  if (zenskiChecked) {
                                    // Uncheck zenski → katalog
                                    setZenskiChecked(false);
                                  } else {
                                    // Check zenski → uncheck muski
                                    setZenskiChecked(true);
                                    setMuskiChecked(false);
                                  }
                                }
                              }}
                              disabled={isDisabled}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className={cn(
                              "text-sm",
                              isChecked ? "text-primary font-medium" : "text-text-muted"
                            )}>
                              {option.label}
                            </span>
                          </div>
                          {!countsLoading && count !== undefined && (
                            <span className="text-xs text-text-muted">({count})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              {/* Sale - Akcije */}
              <Accordion.Item value="sale" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Akcije
                  {onSale && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      1
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  <label className="flex items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onSale}
                      onChange={() => setOnSale(!onSale)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-text-muted">Samo proizvodi na akciji</span>
                  </label>
                </Accordion.Content>
              </Accordion.Item>

              {/* Novo */}
              <Accordion.Item value="novo" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Novo
                  {onNovo && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      1
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  <label className="flex items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onNovo}
                      onChange={() => setOnNovo(!onNovo)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-text-muted">Samo nova kolekcija</span>
                  </label>
                </Accordion.Content>
              </Accordion.Item>

              {/* Brands */}
              <Accordion.Item value="brand" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Brendovi
                  {selectedBrands.length > 0 && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      {selectedBrands.length}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  {loadingBrands ? (
                    <div className="py-2 text-sm text-text-muted">Učitavanje...</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {brands.map((brand) => {
                        const count = counts?.brands?.[brand.name];
                        const isDisabled = count === 0;
                        const brandIdStr = String(brand.id);
                        const isChecked = selectedBrands.includes(brandIdStr);

                        return (
                          <label
                            key={brand.id}
                            className={cn(
                              "flex items-center justify-between gap-3",
                              isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isDisabled) return;
                                  setSelectedBrands(prev =>
                                    prev.includes(brandIdStr)
                                      ? prev.filter(b => b !== brandIdStr)
                                      : [...prev, brandIdStr]
                                  );
                                }}
                                disabled={isDisabled}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <span className={cn(
                                "text-sm text-text-muted",
                                isChecked && 'text-primary font-medium'
                              )}>
                                {brand.name}
                              </span>
                            </div>
                            {!countsLoading && count !== undefined && (
                              <span className="text-xs text-text-muted">({count})</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </Accordion.Content>
              </Accordion.Item>

              {/* Product Type */}
              {PRODUCT_TYPES.length > 0 && <Accordion.Item value="tip" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Tip proizvoda
                  {selectedTypes.length > 0 && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      {selectedTypes.length}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  <div className="space-y-2">
                    {PRODUCT_TYPES.map((type) => {
                      const count = counts?.types?.[type.value];
                      const isDisabled = count === 0;

                      return (
                        <label
                          key={type.value}
                          className={cn(
                            "flex items-center justify-between gap-3",
                            isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedTypes.includes(type.value)}
                              onChange={() => {
                                if (isDisabled) return;
                                setSelectedTypes(prev =>
                                  prev.includes(type.value)
                                    ? prev.filter(t => t !== type.value)
                                    : [...prev, type.value]
                                );
                              }}
                              disabled={isDisabled}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-text-muted">{type.label}</span>
                          </div>
                          {!countsLoading && count !== undefined && (
                            <span className="text-xs text-text-muted">({count})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </Accordion.Content>
              </Accordion.Item>}

              {/* Size */}
              <Accordion.Item value="size" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Veličina
                  {selectedSizes.length > 0 && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      {selectedSizes.length}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  <div className="flex flex-wrap gap-2">
                    {SIZE_OPTIONS.map((size) => {
                      const count = counts?.sizes?.[size];
                      const isDisabled = count === 0;

                      return (
                        <button
                          key={size}
                          onClick={() => {
                            if (isDisabled) return;
                            setSelectedSizes(prev =>
                              prev.includes(size)
                                ? prev.filter(s => s !== size)
                                : [...prev, size]
                            );
                          }}
                          disabled={isDisabled}
                          className={cn(
                            'w-14 h-14 rounded-lg text-sm font-medium transition-colors flex flex-col items-center justify-center',
                            selectedSizes.includes(size)
                              ? 'bg-primary text-white'
                              : isDisabled
                                ? 'bg-background-alt text-text-muted opacity-50 cursor-not-allowed'
                                : 'bg-background-alt text-text'
                          )}
                        >
                          <span>{size}</span>
                          {!countsLoading && count !== undefined && (
                            <span className={cn(
                              "text-[10px]",
                              selectedSizes.includes(size) ? "text-white/80" : "text-text-muted"
                            )}>
                              ({count})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              {/* Color */}
              <Accordion.Item value="color" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Boja
                  {selectedColors.length > 0 && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      {selectedColors.length}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  <div className="space-y-2">
                    {COLOR_OPTIONS.map((color) => {
                      const count = counts?.colors?.[color.value];
                      const isDisabled = count === 0;

                      return (
                        <button
                          key={color.value}
                          onClick={() => {
                            if (isDisabled) return;
                            setSelectedColors(prev =>
                              prev.includes(color.value)
                                ? prev.filter(c => c !== color.value)
                                : [...prev, color.value]
                            );
                          }}
                          disabled={isDisabled}
                          className={cn(
                            'flex items-center justify-between w-full py-1.5',
                            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'w-6 h-6 rounded-full transition-all',
                                color.class,
                                selectedColors.includes(color.value)
                                  ? 'ring-2 ring-offset-2 ring-primary'
                                  : ''
                              )}
                            />
                            <span className="text-sm text-text-muted">{color.label}</span>
                          </div>
                          {!countsLoading && count !== undefined && (
                            <span className="text-xs text-text-muted">({count})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              {/* Price */}
              <Accordion.Item value="price" className="border-b border-border">
                <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text group">
                  Cena
                  {selectedPrice && (
                    <span className="mr-2 px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      1
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="pb-4">
                  <div className="space-y-2">
                    {PRICE_RANGES.map((range) => (
                      <label key={range.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="price"
                          checked={selectedPrice === range.value}
                          onChange={() => setSelectedPrice(range.value)}
                          className="w-4 h-4 border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-text-muted">{range.label}</span>
                      </label>
                    ))}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={clearFilters}
                className="flex-1"
              >
                Obriši
              </Button>
              <Button
                onClick={applyFilters}
                className="flex-1"
              >
                Primeni ({activeFiltersCount})
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Filter button for mobile
export function MobileFilterButton() {
  const { openMobileFilters } = useUIStore();
  const searchParams = useSearchParams();

  // Count active filters (standardized params)
  const activeCount = searchParams.getAll('size').length +
    searchParams.getAll('color').length +
    searchParams.getAll('type').length +
    searchParams.getAll('brand').length +
    (searchParams.get('priceMax') ? 1 : 0) +
    (searchParams.get('sale') ? 1 : 0) +
    (searchParams.get('novo') ? 1 : 0);

  return (
    <button
      onClick={openMobileFilters}
      className="lg:hidden flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text hover:border-primary transition-colors"
    >
      <SlidersHorizontal className="h-4 w-4" />
      Filteri
      {activeCount > 0 && (
        <span className="px-2 py-0.5 bg-primary text-white text-xs rounded-full">
          {activeCount}
        </span>
      )}
    </button>
  );
}
