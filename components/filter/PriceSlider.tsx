'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PriceSliderProps {
  min: number;
  max: number;
  step?: number;
  defaultMin?: number;
  defaultMax?: number;
  onChange?: (min: number, max: number) => void;
}

export function PriceSlider({
  min,
  max,
  step = 100,
  defaultMin = min,
  defaultMax = max,
  onChange,
}: PriceSliderProps) {
  const [minVal, setMinVal] = useState(defaultMin);
  const [maxVal, setMaxVal] = useState(defaultMax);
  const [isDragging, setIsDragging] = useState(false);

  // Update internal state when defaults change
  useEffect(() => {
    setMinVal(defaultMin);
    setMaxVal(defaultMax);
  }, [defaultMin, defaultMax]);

  // Calculate percentage for slider track
  const minPercent = ((minVal - min) / (max - min)) * 100;
  const maxPercent = ((maxVal - min) / (max - min)) * 100;

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxVal - step);
    setMinVal(value);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minVal + step);
    setMaxVal(value);
  };

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onChange?.(minVal, maxVal);
    }
  }, [isDragging, minVal, maxVal, onChange]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  // Apply filter on mouse up
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseUp]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('sr-RS').format(value);
  };

  const handleInputChange = (type: 'min' | 'max', value: string) => {
    const numValue = parseInt(value.replace(/\D/g, '')) || 0;
    if (type === 'min') {
      const newMin = Math.max(min, Math.min(numValue, maxVal - step));
      setMinVal(newMin);
      onChange?.(newMin, maxVal);
    } else {
      const newMax = Math.min(max, Math.max(numValue, minVal + step));
      setMaxVal(newMax);
      onChange?.(minVal, newMax);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Slider container */}
      <div className="relative h-6">
        {/* Track background */}
        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-border rounded-full -translate-y-1/2" />

        {/* Active track */}
        <div
          className="absolute top-1/2 h-1.5 bg-primary rounded-full -translate-y-1/2"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
          }}
        />

        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={handleMinChange}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className={cn(
            'absolute w-full h-6 appearance-none bg-transparent pointer-events-none',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto',
            '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary',
            '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md',
            '[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform',
            '[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto',
            '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary',
            '[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md'
          )}
          style={{ zIndex: minVal > max - 100 ? 5 : 3 }}
        />

        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className={cn(
            'absolute w-full h-6 appearance-none bg-transparent pointer-events-none',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto',
            '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary',
            '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md',
            '[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform',
            '[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto',
            '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary',
            '[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md'
          )}
          style={{ zIndex: 4 }}
        />
      </div>

      {/* Input fields */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-text-muted mb-1 block">Od</label>
          <div className="relative">
            <input
              type="text"
              value={formatPrice(minVal)}
              onChange={(e) => handleInputChange('min', e.target.value)}
              className="w-full h-9 px-3 pr-10 text-sm border border-border rounded-md focus:outline-none focus:border-primary"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
              RSD
            </span>
          </div>
        </div>
        <div className="pt-5 text-text-muted">—</div>
        <div className="flex-1">
          <label className="text-xs text-text-muted mb-1 block">Do</label>
          <div className="relative">
            <input
              type="text"
              value={formatPrice(maxVal)}
              onChange={(e) => handleInputChange('max', e.target.value)}
              className="w-full h-9 px-3 pr-10 text-sm border border-border rounded-md focus:outline-none focus:border-primary"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
              RSD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
