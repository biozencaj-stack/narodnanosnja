'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Brand {
  id: string;
  name: string;
  logo: string;
  link: string;
  hasLogo?: boolean; // Whether the brand has a logo image available
  scale?: number; // Custom scale for logos that need to be larger (1.0 = normal, 1.3 = 30% larger)
}

interface BrandSliderProps {
  brands?: Brand[];
  autoPlay?: boolean;
  slidesPerView?: number;
}

// Default placeholder brands - replace with actual brand data from admin panel
const defaultBrands: Brand[] = [
  { id: 'brand-1', name: 'Brand One', logo: '', link: '/catalog', hasLogo: false },
  { id: 'brand-2', name: 'Brand Two', logo: '', link: '/catalog', hasLogo: false },
  { id: 'brand-3', name: 'Brand Three', logo: '', link: '/catalog', hasLogo: false },
  { id: 'brand-4', name: 'Brand Four', logo: '', link: '/catalog', hasLogo: false },
  { id: 'brand-5', name: 'Brand Five', logo: '', link: '/catalog', hasLogo: false },
  { id: 'brand-6', name: 'Brand Six', logo: '', link: '/catalog', hasLogo: false },
];

export function BrandSlider({
  brands = defaultBrands,
  autoPlay = true,
}: BrandSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate for infinite scroll
  const duplicatedBrands = [...brands, ...brands];

  return (
    <section className="bg-white py-12 lg:py-16 overflow-hidden">
      <div className="container-wide mb-8">
        <h2 className="font-display text-2xl lg:text-3xl text-text text-center">
          Naši Brendovi
        </h2>
      </div>

      <div
        ref={containerRef}
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className={`flex gap-8 lg:gap-12 ${autoPlay && !isPaused ? 'animate-scroll' : ''}`}
          style={{
            width: 'max-content',
          }}
        >
          {duplicatedBrands.map((brand, index) => (
            <Link
              key={`${brand.id}-${index}`}
              href={brand.link}
              className="flex-shrink-0 w-32 lg:w-40 h-16 lg:h-20 relative
                         transition-all duration-300 ease-out"
              title={brand.name}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {brand.hasLogo ? (
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    width={140}
                    height={70}
                    className="object-contain max-h-14 lg:max-h-16 w-auto
                               grayscale opacity-60 hover:grayscale-0 hover:opacity-100
                               transition-all duration-300"
                    style={brand.scale ? { transform: `scale(${brand.scale})` } : undefined}
                  />
                ) : (
                  <span className="text-lg font-bold text-text-muted hover:text-primary transition-colors">
                    {brand.name}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 40s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}

// Alternative static grid version (no animation)
export function BrandGrid({ brands = defaultBrands }: { brands?: Brand[] }) {
  return (
    <section className="bg-white py-12 lg:py-16">
      <div className="container-wide">
        <h2 className="font-display text-2xl lg:text-3xl text-text text-center mb-10">
          Naši Brendovi
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={brand.link}
              className="group flex items-center justify-center h-24 lg:h-28 p-4
                         bg-background-alt rounded-2xl border border-transparent
                         hover:border-primary/20
                         hover:shadow-lg hover:shadow-primary/10
                         hover:scale-105 active:scale-95
                         transition-all duration-300 ease-out"
              title={brand.name}
            >
              {brand.hasLogo ? (
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={140}
                  height={70}
                  className="object-contain max-h-14 lg:max-h-16 w-auto
                             grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100
                             transition-all duration-300"
                  style={brand.scale ? { transform: `scale(${brand.scale})` } : undefined}
                />
              ) : (
                <span className="text-sm lg:text-base font-semibold text-text-muted text-center
                                 group-hover:text-primary transition-colors duration-300">
                  {brand.name}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default BrandSlider;
