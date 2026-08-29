'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const PER_PAGE_OPTIONS = [12, 24, 48];

interface PerPageSelectorProps {
  currentPerPage?: number;
}

export function PerPageSelector({ currentPerPage = 24 }: PerPageSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (value: number) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when changing perPage
    params.delete('page');

    if (value === 24) {
      params.delete('perPage');
    } else {
      params.set('perPage', String(value));
    }

    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-text-muted hidden sm:inline">Prikaži:</span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-md hover:border-primary transition-colors">
            <span className="font-medium">{currentPerPage}</span>
            <ChevronDown className="w-4 h-4 text-text-muted" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="min-w-[80px] bg-background rounded-lg shadow-lg border border-border p-1 animate-fade-in z-50"
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <DropdownMenu.Item
                key={option}
                onSelect={() => handleChange(option)}
                className={cn(
                  'flex items-center justify-center px-3 py-2 text-sm rounded-md cursor-pointer outline-none',
                  currentPerPage === option
                    ? 'bg-primary-light text-primary font-medium'
                    : 'hover:bg-background-alt'
                )}
              >
                {option}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span className="text-text-muted hidden sm:inline">po stranici</span>
    </div>
  );
}
