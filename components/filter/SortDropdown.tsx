'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

const sortOptions = [
  { label: 'Najnovije', value: 'newest' },
  { label: 'Cena: Rastuće', value: 'price_asc' },
  { label: 'Cena: Opadajuće', value: 'price_desc' },
  { label: 'Naziv', value: 'name' },
];

export function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get('sort') || 'newest';
  const currentLabel = sortOptions.find((o) => o.value === currentSort)?.label || 'Sortiraj';

  const handleSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:border-primary transition-colors sm:gap-2 sm:px-4">
          <span className="hidden text-text-muted sm:inline">Sortiraj po:</span>
          <span className="font-medium">{currentLabel}</span>
          <ChevronDown className="h-4 w-4 text-text-muted" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="min-w-[200px] bg-background rounded-lg shadow-lg border border-border p-1 animate-fade-in z-50"
        >
          {sortOptions.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={() => handleSort(option.value)}
              className={cn(
                'flex items-center px-3 py-2 text-sm rounded-md cursor-pointer outline-none',
                currentSort === option.value
                  ? 'bg-primary-light text-primary font-medium'
                  : 'hover:bg-background-alt'
              )}
            >
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
