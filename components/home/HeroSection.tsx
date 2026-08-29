import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { getStoreIdentity } from '@/lib/config/store-settings';

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  backgroundImage?: string;
}

export async function HeroSection({
  title = 'Dobrodošli u Našu Prodavnicu',
  subtitle = 'Otkrijte široku ponudu kvalitetnih proizvoda po najboljim cenama. Brza dostava na teritoriji cele Srbije.',
  ctaText = 'Istraži ponudu',
  ctaLink = '/catalog',
  secondaryCtaText = 'Pogledaj akcije',
  secondaryCtaLink = '/catalog?sale=true',
  backgroundImage = '/images/banners/1.png',
}: HeroSectionProps) {
  const { name: storeName } = await getStoreIdentity();

  return (
    <section className="relative h-[75vh] min-h-[550px] max-h-[850px] overflow-hidden">
      {/* Background image */}
      <Image
        src={backgroundImage}
        alt={storeName}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center scale-105"
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/30 z-10" />

      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-5 z-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23005836' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      {/* Content */}
      <div className="relative z-20 container-wide h-full flex items-center">
        <div className="max-w-2xl py-12">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-text leading-[1.1] mb-6 animate-fade-in" style={{ animationDelay: '50ms' }}>
            {title}
          </h1>
          <p className="text-lg md:text-xl text-text-muted mb-10 max-w-lg leading-relaxed animate-fade-in" style={{ animationDelay: '100ms' }}>
            {subtitle}
          </p>

          <div className="flex flex-wrap gap-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <Button size="lg" asChild className="shadow-lg shadow-primary/25">
              <Link href={ctaLink}>
                {ctaText}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="shadow-md">
              <Link href={secondaryCtaLink}>
                {secondaryCtaText}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 hidden md:flex flex-col items-center gap-2 text-text-muted animate-bounce">
        <span className="text-xs uppercase tracking-widest">Skrolujte</span>
        <div className="w-px h-8 bg-text-muted/50" />
      </div>
    </section>
  );
}
