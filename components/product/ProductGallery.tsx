'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toImageDataUri } from '@/lib/utils/image';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
  image?: string;
  alt: string;
}

export function ProductGallery({ image, alt }: ProductGalleryProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  const imageSrc = toImageDataUri(image);

  return (
    <div className="space-y-4">
      {/* Main image - responsive min/max heights for mobile/tablet/desktop */}
      <div
        className={cn(
          'relative aspect-square bg-background-alt rounded-xl overflow-hidden cursor-zoom-in',
          'min-h-[280px] sm:min-h-[400px] lg:min-h-[500px]',
          'max-h-[400px] sm:max-h-[500px] lg:max-h-[700px]',
          isZoomed && 'cursor-zoom-out'
        )}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      >
        {imageSrc ? (
          <>
            {/* Normal image */}
            <Image
              src={imageSrc}
              alt={alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className={cn(
                'object-contain p-8 transition-opacity duration-200',
                isZoomed && 'opacity-0'
              )}
              priority
            />

            {/* Zoomed image */}
            {isZoomed && (
              <div
                className="absolute inset-0 bg-white"
                style={{
                  backgroundImage: `url(${imageSrc})`,
                  backgroundSize: '250%',
                  backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-light">
            <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Zoom hint */}
      <p className="text-center text-sm text-text-muted">
        Pređite mišem preko slike za uvećanje
      </p>
    </div>
  );
}
