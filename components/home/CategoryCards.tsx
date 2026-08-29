'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Category {
  name: string;
  description?: string;
  href: string;
  image?: string;
  external?: boolean;
}

const categories: Category[] = [
  {
    name: 'Katalog',
    description: 'Svi proizvodi',
    href: '/catalog',
    image: '/images/categories/muska-obuca.jpg',
  },
  {
    name: 'Novo',
    description: 'Najnoviji proizvodi',
    href: '/catalog?novo=true',
    image: '/images/categories/zenska-obuca.jpg',
  },
  {
    name: 'Akcije',
    description: 'Najbolje ponude',
    href: '/catalog?sale=true',
    image: '/images/categories/akcije.jpg',
  },
];

// Shared Card Component
function CategoryCard({
  category,
  isActive,
  onHover,
  index = 0,
}: {
  category: Category;
  isActive: boolean;
  onHover: () => void;
  index?: number;
}) {
  return (
    <Link
      href={category.href}
      target={category.external ? '_blank' : undefined}
      rel={category.external ? 'noopener noreferrer' : undefined}
      className={cn(
        'relative block w-full h-full rounded-2xl overflow-hidden shadow-xl',
        'transition-all duration-300 ease-out',
        isActive && 'shadow-2xl'
      )}
      onMouseEnter={onHover}
      onTouchStart={onHover}
    >
      {/* Category image - optimized sizes for actual displayed dimensions */}
      {category.image && (
        <Image
          src={category.image}
          alt={category.name}
          fill
          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 300px, (max-width: 1279px) 380px, 420px"
          quality={75}
          priority={index === 0}
          fetchPriority={index === 0 ? "high" : "auto"}
          className={cn(
            'object-cover transition-transform duration-500',
            isActive && 'scale-105'
          )}
        />
      )}

      {/* Overlay - DARK gradient from bottom, covers bottom 60% */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 h-[60%] transition-all duration-300',
          isActive
            ? 'bg-gradient-to-t from-black/95 via-black/55 to-transparent'
            : 'bg-gradient-to-t from-black/80 via-black/35 to-transparent'
        )}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-end p-5 md:p-6 lg:p-8 text-center">
        {/* Title - WHITE text with shadow */}
        <h3 className={cn(
          'font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-wide',
          '!text-white',
          '[text-shadow:_0_2px_12px_rgba(0,0,0,0.9),_0_4px_20px_rgba(0,0,0,0.7)]',
          'transition-all duration-300',
          isActive ? 'mb-1 md:mb-2' : 'mb-4 md:mb-6'
        )}>
          {category.name}
        </h3>

        {/* Description - WHITE text, shows on active */}
        <p className={cn(
          'text-sm md:text-base lg:text-lg font-medium',
          '!text-white',
          '[text-shadow:_0_2px_8px_rgba(0,0,0,0.8)]',
          'transition-all duration-300',
          isActive ? 'opacity-100 mb-3 md:mb-4' : 'opacity-0 mb-0 h-0 overflow-hidden'
        )}>
          {category.description}
        </p>

        {/* White button with dark arrow - shows on active */}
        <div className={cn(
          'transition-all duration-300',
          isActive ? 'opacity-100 translate-y-0 mb-2 md:mb-4' : 'opacity-0 translate-y-4 mb-0'
        )}>
          <span className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-white shadow-xl hover:bg-gray-100 hover:scale-110 transition-all">
            <svg className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CategoryCards() {
  const [activeIndex, setActiveIndex] = useState<number>(1); // Middle card active by default

  return (
    <section className="py-12 md:py-16 lg:py-24 bg-background">
      <div className="container-wide">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl text-text mb-3 md:mb-4">
            Izdvojene kategorije
          </h2>
          <p className="text-text-muted text-sm md:text-base max-w-2xl mx-auto px-4">
            Pronađite savršene proizvode za svaku priliku
          </p>
        </div>

        {/* MOBILE: Vertical stack */}
        <div className="md:hidden flex flex-col gap-6">
          {categories.map((category, idx) => (
            <div key={category.name} className="w-full h-[400px] relative">
              <CategoryCard
                category={category}
                isActive={true}
                onHover={() => {}}
                index={idx}
              />
            </div>
          ))}
        </div>

        {/* TABLET/DESKTOP: Overlapping cards */}
        <div className="hidden md:block">
          <div className="relative flex justify-center items-center min-h-[500px] lg:min-h-[600px]">
            <div className="relative flex items-center justify-center">
              {categories.map((category, index) => {
                const isActive = activeIndex === index;
                const position = index - 1; // -1 (left), 0 (center), 1 (right)
                const offsetMultiplier = 75; // 25% overlap

                return (
                  <div
                    key={category.name}
                    className={cn(
                      // Size
                      'w-[300px] lg:w-[380px] xl:w-[420px]',
                      'aspect-[3/4]',
                      // Position
                      index === 0 && 'absolute',
                      index === 2 && 'absolute',
                      index === 1 && 'relative',
                      // Transitions
                      'transition-all duration-400 ease-out'
                    )}
                    style={{
                      transform: `
                        translateX(${position * offsetMultiplier}%)
                        scale(${isActive ? 1.05 : 0.9})
                        translateY(${isActive ? -10 : 0}px)
                      `,
                      zIndex: isActive ? 30 : (index === 1 ? 20 : 10),
                    }}
                  >
                    <CategoryCard
                      category={category}
                      isActive={isActive}
                      onHover={() => setActiveIndex(index)}
                      index={index}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop indicators */}
          <div className="flex justify-center gap-3 mt-6">
            {categories.map((cat, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  activeIndex === index
                    ? 'bg-primary w-8'
                    : 'bg-gray-300 w-2 hover:bg-gray-400'
                )}
                aria-label={`Prikaži ${cat.name}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
