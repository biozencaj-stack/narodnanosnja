'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Filter options
const GENDER_OPTIONS = [
  { value: 'muski', label: 'Muški' },
  { value: 'zenski', label: 'Ženski' },
];

const SIZE_OPTIONS = [
  '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'
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

const FOOTWEAR_TYPES = [
  { value: 'CIPELE', label: 'Cipele' },
  { value: 'CIPELE POTPETICA', label: 'Cipele sa potpeticom' },
  { value: 'POLUDUBOKE CIPELE', label: 'Poluduboka obuća' },
  { value: 'DUBOKE CIPELE', label: 'Duboke cipele' },
  { value: 'PATIKE', label: 'Patike' },
  { value: 'ČIZME', label: 'Čizme' },
  { value: 'SANDALE', label: 'Sandale' },
  { value: 'SANDALE POTPETICA', label: 'Sandale sa potpeticom' },
  { value: 'PAPUČE', label: 'Papuče' },
  { value: 'BALETANKE', label: 'Baletanke' },
  { value: 'KUĆNA OBUĆA', label: 'Kućna obuća' },
];

const PRICE_RANGES = [
  { value: '5000', label: 'Do 5.000 RSD' },
  { value: '10000', label: 'Do 10.000 RSD' },
  { value: '15000', label: 'Do 15.000 RSD' },
  { value: '20000', label: 'Do 20.000 RSD' },
];

interface FiltersAsideProps {
  brands?: { id: string; name: string }[];
}

export function FiltersAside({ brands = [] }: FiltersAsideProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current filters from URL
  const [selectedGender, setSelectedGender] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<string>('');
  const [onSale, setOnSale] = useState(false);

  // Initialize from URL
  useEffect(() => {
    const gender = searchParams.getAll('pol');
    const brandNames = searchParams.getAll('brend');
    const sizes = searchParams.getAll('size');
    const colors = searchParams.getAll('color');
    const types = searchParams.getAll('tip');
    const price = searchParams.get('price') || '';
    const sale = searchParams.get('akcijesnizenja') === 'true';

    setSelectedGender(gender);
    setSelectedBrands(brandNames);
    setSelectedSizes(sizes);
    setSelectedColors(colors);
    setSelectedTypes(types);
    setSelectedPrice(price);
    setOnSale(sale);
  }, [searchParams]);

  // Update URL with filters
  const updateFilters = (updates: Record<string, string | string[] | boolean>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Clear existing filter params
    params.delete('pol');
    params.delete('brend');
    params.delete('size');
    params.delete('color');
    params.delete('tip');
    params.delete('price');
    params.delete('akcijesnizenja');

    // Add gender
    const gender = updates.gender !== undefined ? updates.gender as string[] : selectedGender;
    gender.forEach(g => params.append('pol', g));

    // Add brands
    const brandNames = updates.brands !== undefined ? updates.brands as string[] : selectedBrands;
    brandNames.forEach(b => params.append('brend', b));

    // Add sizes
    const sizes = updates.sizes !== undefined ? updates.sizes as string[] : selectedSizes;
    sizes.forEach(s => params.append('size', s));

    // Add colors
    const colors = updates.colors !== undefined ? updates.colors as string[] : selectedColors;
    colors.forEach(c => params.append('color', c));

    // Add types
    const types = updates.types !== undefined ? updates.types as string[] : selectedTypes;
    types.forEach(t => params.append('tip', t));

    // Add price
    const price = updates.price !== undefined ? updates.price as string : selectedPrice;
    if (price) params.set('price', price);

    // Add sale
    const sale = updates.onSale !== undefined ? updates.onSale as boolean : onSale;
    if (sale) params.set('akcijesnizenja', 'true');

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Toggle handlers
  const toggleGender = (gender: string) => {
    const newGender = selectedGender.includes(gender)
      ? selectedGender.filter(g => g !== gender)
      : [...selectedGender, gender];
    setSelectedGender(newGender);
    updateFilters({ gender: newGender });
  };

  const toggleBrand = (brand: string) => {
    const newBrands = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand];
    setSelectedBrands(newBrands);
    updateFilters({ brands: newBrands });
  };

  const toggleSize = (size: string) => {
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter(s => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(newSizes);
    updateFilters({ sizes: newSizes });
  };

  const toggleColor = (color: string) => {
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter(c => c !== color)
      : [...selectedColors, color];
    setSelectedColors(newColors);
    updateFilters({ colors: newColors });
  };

  const toggleType = (type: string) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(newTypes);
    updateFilters({ types: newTypes });
  };

  const setPrice = (price: string) => {
    setSelectedPrice(price);
    updateFilters({ price });
  };

  const toggleSale = () => {
    setOnSale(!onSale);
    updateFilters({ onSale: !onSale });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedGender([]);
    setSelectedBrands([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSelectedTypes([]);
    setSelectedPrice('');
    setOnSale(false);
    router.push(pathname, { scroll: false });
  };

  const hasActiveFilters = selectedGender.length > 0 || selectedBrands.length > 0 ||
    selectedSizes.length > 0 || selectedColors.length > 0 ||
    selectedTypes.length > 0 || selectedPrice || onSale;

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="sticky top-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg text-text">Filteri</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary hover:underline"
            >
              Obriši sve
            </button>
          )}
        </div>

        <Accordion.Root type="multiple" defaultValue={['tip', 'size', 'brend']} className="space-y-2">
          {/* Sale filter */}
          <div className="py-3 border-b border-border">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={onSale}
                onChange={toggleSale}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-text group-hover:text-primary transition-colors">
                Samo sniženo
              </span>
            </label>
          </div>

          {/* Gender / Pol */}
          <Accordion.Item value="pol" className="border-b border-border">
            <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text hover:text-primary transition-colors group">
              Pol
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
            <Accordion.Content className="pb-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="space-y-2">
                {GENDER_OPTIONS.map((gender) => (
                  <label key={gender.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedGender.includes(gender.value)}
                      onChange={() => toggleGender(gender.value)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-text-muted group-hover:text-text transition-colors">
                      {gender.label}
                    </span>
                  </label>
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>

          {/* Brands / Brendovi */}
          {brands.length > 0 && (
            <Accordion.Item value="brend" className="border-b border-border">
              <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text hover:text-primary transition-colors group">
                Brendovi
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
              <Accordion.Content className="pb-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {brands.map((brand) => (
                    <label key={brand.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand.name)}
                        onChange={() => toggleBrand(brand.name)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-text-muted group-hover:text-text transition-colors">
                        {brand.name}
                      </span>
                    </label>
                  ))}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          )}

          {/* Footwear Type */}
          <Accordion.Item value="tip" className="border-b border-border">
            <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text hover:text-primary transition-colors group">
              Tip obuće
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
            <Accordion.Content className="pb-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="space-y-2">
                {FOOTWEAR_TYPES.map((type) => (
                  <label key={type.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleType(type.value)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-text-muted group-hover:text-text transition-colors">
                      {type.label}
                    </span>
                  </label>
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>

          {/* Size */}
          <Accordion.Item value="size" className="border-b border-border">
            <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text hover:text-primary transition-colors group">
              Veličina
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
            <Accordion.Content className="pb-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => toggleSize(size)}
                    className={cn(
                      'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                      selectedSizes.includes(size)
                        ? 'bg-primary text-white'
                        : 'bg-background-alt text-text hover:bg-primary-light hover:text-primary'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>

          {/* Color */}
          <Accordion.Item value="color" className="border-b border-border">
            <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text hover:text-primary transition-colors group">
              Boja
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
            <Accordion.Content className="pb-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="flex flex-wrap gap-3">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => toggleColor(color.value)}
                    title={color.label}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      color.class,
                      selectedColors.includes(color.value)
                        ? 'ring-2 ring-offset-2 ring-primary'
                        : 'hover:scale-110'
                    )}
                  />
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>

          {/* Price */}
          <Accordion.Item value="price" className="border-b border-border">
            <Accordion.Trigger className="flex items-center justify-between w-full py-3 text-sm font-medium text-text hover:text-primary transition-colors group">
              Cena
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
            <Accordion.Content className="pb-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="space-y-2">
                {PRICE_RANGES.map((range) => (
                  <label key={range.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="price"
                      checked={selectedPrice === range.value}
                      onChange={() => setPrice(range.value)}
                      className="w-4 h-4 border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-text-muted group-hover:text-text transition-colors">
                      {range.label}
                    </span>
                  </label>
                ))}
                {selectedPrice && (
                  <button
                    onClick={() => setPrice('')}
                    className="text-xs text-primary hover:underline mt-2"
                  >
                    Obriši filter cene
                  </button>
                )}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </div>
    </aside>
  );
}
