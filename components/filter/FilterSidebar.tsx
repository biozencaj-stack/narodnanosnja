'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion';
import { Button } from '@/components/ui/Button';
import { PriceSlider } from './PriceSlider';
import { cn } from '@/lib/utils';
import { useFilterCounts } from '@/lib/hooks';

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface Brand {
  id: string;
  name: string;
}

interface FilterSidebarProps {
  showGenderFilter?: boolean;
  brands?: Brand[];
  currentBrand?: string;
  baseUrl?: string;
  groupId?: string; // For brand pages - used for counts
}

const sizeOptions: FilterOption[] = [
  ...['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => ({ label: s, value: s })),
  ...Array.from({ length: 13 }, (_, i) => ({
    label: String(35 + i),
    value: String(35 + i),
  })),
];

const colorOptions: FilterOption[] = [
  { label: 'Crna', value: 'crna' },
  { label: 'Bela', value: 'bela' },
  { label: 'Braon', value: 'braon' },
  { label: 'Siva', value: 'siva' },
  { label: 'Plava', value: 'plava' },
  { label: 'Crvena', value: 'crvena' },
  { label: 'Bež', value: 'bez' },
];

// Product type options - loaded dynamically from categories
const productTypeOptions: FilterOption[] = [];

const genderOptions: FilterOption[] = [
  { label: 'Muški', value: 'muske' },
  { label: 'Ženski', value: 'zenske' },
];

export function FilterSidebar({
  showGenderFilter = false,
  brands: initialBrands,
  currentBrand,
  baseUrl,
  groupId,
}: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>(initialBrands || []);
  const [isLoadingBrands, setIsLoadingBrands] = useState(!initialBrands);

  // Get filter counts
  const { counts, loading: countsLoading } = useFilterCounts({ groupId });

  // Standardized parameter names
  const paramNames = { type: 'type', color: 'color', sale: 'sale', novo: 'novo', price: 'priceMax' };

  // Fetch brands from API
  useEffect(() => {
    if (!initialBrands) {
      fetch('/api/brands')
        .then(res => res.json())
        .then(data => {
          setBrands(data);
          setIsLoadingBrands(false);
        })
        .catch(() => setIsLoadingBrands(false));
    }
  }, [initialBrands]);

  const createQueryString = useCallback(
    (key: string, value: string, remove = false) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset pagination when filters change
      params.delete('page');

      if (remove) {
        const values = params.getAll(key).filter(v => v !== value);
        params.delete(key);
        values.forEach(v => params.append(key, v));
      } else {
        params.append(key, value);
      }

      return params.toString();
    },
    [searchParams]
  );

  const isSelected = (key: string, value: string) => {
    return searchParams.getAll(key).includes(value);
  };

  const handleFilterChange = (key: string, value: string) => {
    const selected = isSelected(key, value);
    const query = createQueryString(key, value, selected);
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  const handleGenderCheckboxChange = (genderValue: 'muske' | 'zenske') => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');

    const currentGender = params.get('gender');
    if (currentGender === genderValue) {
      params.delete('gender');
    } else {
      params.set('gender', genderValue);
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  // Handle brand checkbox change with redirect logic for brand pages
  const handleBrandCheckboxChange = (brandId: string, brandName: string) => {
    const isOnBrandPage = pathname.includes('/brend/');
    const params = new URLSearchParams(searchParams.toString());

    // Reset pagination when filters change
    params.delete('page');

    if (isOnBrandPage) {
      // On a brand page - redirect to category page with query params
      const basePath = pathname.split('/brand/')[0]; // e.g., /catalog

      // Get current brand ID from the page (currentBrand is the name)
      const currentBrandObj = brands.find(b => b.name === currentBrand);
      const currentBrandId = currentBrandObj ? String(currentBrandObj.id) : undefined;

      // Get all currently selected brands from URL params
      let selectedBrands = params.getAll('brand');

      // If no brands in params yet, add the current page brand
      if (selectedBrands.length === 0 && currentBrandId) {
        selectedBrands = [currentBrandId];
      }

      // Toggle the clicked brand
      if (selectedBrands.includes(brandId)) {
        // Remove this brand
        selectedBrands = selectedBrands.filter(b => b !== brandId);
      } else {
        // Add this brand
        selectedBrands.push(brandId);
      }

      // Clear old brand params and add new ones
      params.delete('brand');
      selectedBrands.forEach(b => params.append('brand', b));

      const queryString = params.toString();
      router.replace(queryString ? `${basePath}?${queryString}` : basePath, { scroll: false });
    } else {
      // Not on brand page - use standard toggle logic
      handleFilterChange('brand', brandId);
    }
  };

  const handlePriceChange = (min: number, max: number) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset pagination when filters change
    params.delete('page');

    if (min > 0) {
      params.set('priceMin', String(min));
    } else {
      params.delete('priceMin');
    }
    if (max < 50000) {
      params.set('priceMax', String(max));
    } else {
      params.delete('priceMax');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearAllFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  // Check if any filters are active
  const hasActiveFilters =
    searchParams.getAll('size').length > 0 ||
    searchParams.getAll('color').length > 0 ||
    searchParams.getAll('type').length > 0 ||
    searchParams.getAll('brand').length > 0 ||
    searchParams.get('gender') !== null ||
    searchParams.get('priceMin') !== null ||
    searchParams.get('priceMax') !== null ||
    searchParams.get('sale') === 'true' ||
    searchParams.get('novo') === 'true';

  // Get active filter labels for display
  const getActiveFilterLabels = () => {
    const labels: { key: string; value: string; label: string }[] = [];
    const seenKeys = new Set<string>();

    searchParams.getAll('size').forEach(v => {
      const uniqueKey = `size-${v}`;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        labels.push({ key: 'size', value: v, label: `Vel. ${v}` });
      }
    });
    searchParams.getAll('color').forEach(v => {
      const uniqueKey = `color-${v}`;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        const opt = colorOptions.find(o => o.value === v);
        labels.push({ key: 'color', value: v, label: opt?.label || v });
      }
    });
    searchParams.getAll('type').forEach(v => {
      const uniqueKey = `type-${v}`;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        const opt = productTypeOptions.find(o => o.value === v);
        labels.push({ key: 'type', value: v, label: opt?.label || v });
      }
    });
    searchParams.getAll('brand').forEach(v => {
      const uniqueKey = `brand-${v}`;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        // Compare as strings since URL params are always strings
        const brand = brands.find(b => String(b.id) === String(v));
        labels.push({ key: 'brand', value: v, label: brand?.name || v });
      }
    });
    if (searchParams.get('gender')) {
      const opt = genderOptions.find(o => o.value === searchParams.get('gender'));
      labels.push({ key: 'gender', value: searchParams.get('gender')!, label: opt?.label || '' });
    }
    if (searchParams.get('novo') === 'true') {
      labels.push({ key: 'novo', value: 'true', label: 'Novo' });
    }

    return labels;
  };

  const currentPriceMin = parseInt(searchParams.get('priceMin') || '0');
  const currentPriceMax = parseInt(searchParams.get('priceMax') || '50000');

  // Controlled accordion state - tracks which sections are open
  const isGenderActive = !!searchParams.get('gender');
  const isSaleActive = searchParams.get('sale') === 'true';
  const isNovoActive = searchParams.get('novo') === 'true';

  const [openAccordions, setOpenAccordions] = useState<string[]>(['brand', 'type']);

  // Update open accordions when URL changes
  useEffect(() => {
    setOpenAccordions(prev => {
      const newOpen = new Set(prev);

      // Add 'gender' if active and showGenderFilter is true
      if (showGenderFilter && isGenderActive) {
        newOpen.add('gender');
      }

      // Add 'sale' if sale filter is active
      if (isSaleActive) {
        newOpen.add('sale');
      }

      // Add 'novo' if novo filter is active
      if (isNovoActive) {
        newOpen.add('novo');
      }

      return Array.from(newOpen);
    });
  }, [pathname, isSaleActive, isNovoActive, isGenderActive, showGenderFilter]);

  // Helper to format count display
  const formatCount = (count: number | undefined) => {
    if (countsLoading) return '';
    if (count === undefined) return '';
    return ` (${count})`;
  };

  return (
    <aside className="w-full max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-white py-2 z-10">
        <h2 className="text-lg font-semibold text-text">Filteri</h2>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Obriši sve
          </Button>
        )}
      </div>

      {/* Active filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-6">
          {getActiveFilterLabels().map(({ key, value, label }) => (
            <button
              key={`${key}-${value}`}
              onClick={() => {
                if (key === 'gender') {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('gender');
                  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                } else if (key === 'novo') {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('novo');
                  params.delete('page');
                  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                } else {
                  handleFilterChange(key, value);
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-primary-light text-primary text-sm rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              {label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Filter groups */}
      <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions}>

        {/* Gender filter - checkbox based, only shown when prop is true */}
        {showGenderFilter && (
          <AccordionItem value="gender">
            <AccordionTrigger>Pol</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {genderOptions.map(option => {
                  const currentGender = searchParams.get('gender');
                  const isChecked = currentGender === option.value;

                  const count = counts?.gender?.[option.value];
                  const isDisabled = !count;

                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center justify-between gap-3 py-2",
                        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => !isDisabled && handleGenderCheckboxChange(option.value as 'muske' | 'zenske')}
                          disabled={isDisabled}
                          className="accent-primary w-4 h-4"
                        />
                        <span className={cn(
                          'text-sm',
                          isChecked && 'text-primary font-medium'
                        )}>
                          {option.label}
                        </span>
                      </div>
                      {!countsLoading && (
                        <span className="text-xs text-text-muted">({count ?? 0})</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Sale filter - moved after gender */}
        <AccordionItem value="sale">
          <AccordionTrigger>Akcije</AccordionTrigger>
          <AccordionContent>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchParams.get(paramNames.sale) === 'true'}
                onChange={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('page');
                  if (params.get(paramNames.sale) === 'true') {
                    params.delete(paramNames.sale);
                  } else {
                    params.set(paramNames.sale, 'true');
                  }
                  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                }}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm">Samo proizvodi na akciji</span>
            </label>
          </AccordionContent>
        </AccordionItem>

        {/* Novo filter */}
        <AccordionItem value="novo">
          <AccordionTrigger>Novo</AccordionTrigger>
          <AccordionContent>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchParams.get(paramNames.novo) === 'true'}
                onChange={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('page');
                  if (params.get(paramNames.novo) === 'true') {
                    params.delete(paramNames.novo);
                  } else {
                    params.set(paramNames.novo, 'true');
                  }
                  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                }}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm">Samo nova kolekcija</span>
            </label>
          </AccordionContent>
        </AccordionItem>

        {/* Brand filter - checkboxes for multi-select */}
        <AccordionItem value="brand">
          <AccordionTrigger>Brendovi</AccordionTrigger>
          <AccordionContent>
            {isLoadingBrands ? (
              <div className="py-4 text-sm text-text-muted">Učitavanje...</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {brands.map(brand => {
                  const count = counts?.brands?.[brand.name];
                  const isDisabled = !count;
                  const isChecked = isSelected('brand', String(brand.id)) || currentBrand === brand.name;

                  return (
                    <label
                      key={brand.id}
                      className={cn(
                        "flex items-center justify-between gap-3 py-1.5",
                        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => !isDisabled && handleBrandCheckboxChange(String(brand.id), brand.name)}
                          disabled={isDisabled}
                          className="accent-primary w-4 h-4"
                        />
                        <span className={cn(
                          'text-sm',
                          isChecked && 'text-primary font-medium'
                        )}>
                          {brand.name}
                        </span>
                      </div>
                      {!countsLoading && (
                        <span className="text-xs text-text-muted">({count ?? 0})</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Footwear type filter */}
        <AccordionItem value="type">
          <AccordionTrigger>Vrsta obuće</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {productTypeOptions.map(option => {
                const count = counts?.types?.[option.value];
                const isDisabled = !count;

                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-center justify-between gap-3 py-1.5",
                      isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected(paramNames.type, option.value)}
                        onChange={() => !isDisabled && handleFilterChange(paramNames.type, option.value)}
                        disabled={isDisabled}
                        className="accent-primary w-4 h-4"
                      />
                      <span className={cn(
                        'text-sm',
                        isSelected(paramNames.type, option.value) && 'text-primary font-medium'
                      )}>
                        {option.label}
                      </span>
                    </div>
                    {!countsLoading && (
                      <span className="text-xs text-text-muted">({count ?? 0})</span>
                    )}
                  </label>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Size filter */}
        <AccordionItem value="size">
          <AccordionTrigger>Veličina</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-4 gap-2">
              {sizeOptions.map(option => {
                const count = counts?.sizes?.[option.value];
                const isDisabled = !count;

                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex flex-col items-center justify-center h-14 border rounded-md text-sm transition-colors',
                      isSelected('size', option.value)
                        ? 'bg-primary text-white border-primary'
                        : isDisabled
                          ? 'border-border opacity-50 cursor-not-allowed'
                          : 'border-border hover:border-primary cursor-pointer'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected('size', option.value)}
                      onChange={() => !isDisabled && handleFilterChange('size', option.value)}
                      disabled={isDisabled}
                      className="sr-only"
                    />
                    <span className="font-medium">{option.label}</span>
                    {!countsLoading && (
                      <span className={cn(
                        "text-[10px]",
                        isSelected('size', option.value) ? "text-white/80" : "text-text-muted"
                      )}>
                        ({count ?? 0})
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Color filter */}
        <AccordionItem value="color">
          <AccordionTrigger>Boja</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {colorOptions.map(option => {
                const count = counts?.colors?.[option.value];
                const isDisabled = !count;

                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-center justify-between gap-3 py-1.5",
                      isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected(paramNames.color, option.value)}
                        onChange={() => !isDisabled && handleFilterChange(paramNames.color, option.value)}
                        disabled={isDisabled}
                        className="accent-primary w-4 h-4"
                      />
                      <span className={cn(
                        'text-sm',
                        isSelected(paramNames.color, option.value) && 'text-primary font-medium'
                      )}>
                        {option.label}
                      </span>
                    </div>
                    {!countsLoading && (
                      <span className="text-xs text-text-muted">({count ?? 0})</span>
                    )}
                  </label>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Price filter */}
        <AccordionItem value="price">
          <AccordionTrigger>Cena</AccordionTrigger>
          <AccordionContent>
            <PriceSlider
              min={0}
              max={50000}
              step={500}
              defaultMin={currentPriceMin}
              defaultMax={currentPriceMax}
              onChange={handlePriceChange}
            />
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </aside>
  );
}
