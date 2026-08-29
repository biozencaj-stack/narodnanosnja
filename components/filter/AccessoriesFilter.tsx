'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

// Accessory categories
const ACCESSORY_CATEGORIES = [
  { value: 'sve', label: 'Sve', itemTitle: null },
  { value: 'torbe', label: 'Torbe', itemTitle: 'Torba' },
  { value: 'novcanici', label: 'Novčanici', itemTitle: 'Novcanik' },
  { value: 'rancevi', label: 'Rančevi', itemTitle: 'Ranac' },
];

interface AccessoriesFilterProps {
  counts?: {
    torbe?: number;
    novcanici?: number;
    rancevi?: number;
    total?: number;
  };
}

export function AccessoriesFilter({ counts }: AccessoriesFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category') || 'sve';

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (category === 'sve') {
      params.delete('category');
    } else {
      params.set('category', category);
    }

    // Reset pagination when changing category
    params.delete('page');

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-text">Kategorija</h3>
      <div className="space-y-2">
        {ACCESSORY_CATEGORIES.map((cat) => {
          const isSelected = currentCategory === cat.value;
          const count = cat.value === 'sve'
            ? counts?.total
            : counts?.[cat.value as keyof typeof counts];

          return (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                isSelected
                  ? 'bg-primary text-white'
                  : 'bg-background-alt hover:bg-primary/10 text-text'
              )}
            >
              <span>{cat.label}</span>
              {count !== undefined && (
                <span className={cn(
                  'text-xs',
                  isSelected ? 'text-white/80' : 'text-text-muted'
                )}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Export categories for use in page
export { ACCESSORY_CATEGORIES };
