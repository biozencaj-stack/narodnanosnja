'use client';

import { cn } from '@/lib/utils';

interface SizeSelectorProps {
  sizes: Record<string, boolean>; // size -> availability
  selectedSize: string | null;
  onSelectSize: (size: string) => void;
  onOpenSizeGuide?: () => void;
}

export function SizeSelector({
  sizes,
  selectedSize,
  onSelectSize,
  onOpenSizeGuide
}: SizeSelectorProps) {
  const sizeEntries = Object.entries(sizes).sort((a, b) => {
    const numA = parseInt(a[0]) || 0;
    const numB = parseInt(b[0]) || 0;
    return numA - numB;
  });

  const allUnavailable = sizeEntries.every(([, available]) => !available);

  if (sizeEntries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text">
        {allUnavailable ? 'Nema na stanju' : 'Izaberite veličinu'}
      </h3>

      <div className="flex flex-wrap gap-2">
        {sizeEntries.map(([size, available]) => (
          <button
            key={size}
            onClick={() => available && onSelectSize(size)}
            disabled={!available}
            className={cn(
              'h-11 min-w-[48px] px-3 rounded-md border-2 text-sm font-medium transition-all',
              available
                ? selectedSize === size
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-text hover:border-primary hover:text-primary'
                : 'border-border bg-background-alt text-text-light cursor-not-allowed line-through'
            )}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Size guide button - more visible and clickable */}
      {onOpenSizeGuide && (
        <button
          onClick={onOpenSizeGuide}
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover font-medium transition-colors group"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <span className="group-hover:underline underline-offset-2">
            Pomoć pri izboru veličine
          </span>
          <svg
            className="w-4 h-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
