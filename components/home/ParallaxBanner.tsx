'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface ParallaxBannerProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  href?: string;
  backgroundImage?: string;
}

export function ParallaxBanner({
  title = 'Otkrijte nešto posebno',
  subtitle = 'Ekskluzivne kolekcije i limitirane serije — samo za vas.',
  buttonText = 'Istraži',
  href = '/catalog',
  backgroundImage = '/images/banners/katalog-banner.jpg',
}: ParallaxBannerProps) {
  return (
    <section className="relative min-h-[400px] lg:min-h-[500px] flex items-center overflow-hidden">
      {/* Background with parallax effect via CSS */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="container-wide relative z-10 py-16 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-white/60 uppercase tracking-widest mb-4">
            Posebna ponuda
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-white leading-tight mb-6">
            {title}
          </h2>
          <p className="text-base lg:text-lg text-white/80 mb-8 leading-relaxed max-w-lg">
            {subtitle}
          </p>
          <Button
            size="lg"
            asChild
            className="bg-white !text-text hover:bg-white/90 shadow-xl"
          >
            <Link href={href}>{buttonText}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
