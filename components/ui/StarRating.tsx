'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'md',
  showValue = false,
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const handleClick = (index: number) => {
    if (interactive && onChange) {
      onChange(index + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (interactive && onChange && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onChange(index + 1);
    }
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex">
        {Array.from({ length: maxRating }).map((_, index) => {
          const filled = index < Math.floor(rating);
          const halfFilled = !filled && index < rating;

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleClick(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={!interactive}
              className={cn(
                'relative transition-transform',
                interactive && 'cursor-pointer hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded',
                !interactive && 'cursor-default'
              )}
              tabIndex={interactive ? 0 : -1}
              aria-label={interactive ? `Oceni ${index + 1} od ${maxRating}` : undefined}
            >
              {/* Background star (empty) */}
              <Star
                className={cn(
                  sizeClasses[size],
                  'text-stone-300'
                )}
              />
              {/* Filled overlay */}
              {(filled || halfFilled) && (
                <Star
                  className={cn(
                    sizeClasses[size],
                    'absolute inset-0 text-amber-400 fill-amber-400',
                    halfFilled && 'clip-path-half'
                  )}
                  style={halfFilled ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
                />
              )}
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-stone-600 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// Compact display version for product cards
interface StarRatingCompactProps {
  rating: number;
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function StarRatingCompact({
  rating,
  count,
  size = 'sm',
  className,
}: StarRatingCompactProps) {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Star className={cn(sizeClasses[size], 'text-amber-400 fill-amber-400')} />
      <span className="text-sm font-medium text-stone-700">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-sm text-stone-500">({count})</span>
      )}
    </div>
  );
}
