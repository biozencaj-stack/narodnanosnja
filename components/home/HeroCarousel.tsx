"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getLocalized } from "@/lib/i18n/localized";

interface Banner {
  id: string;
  title: unknown;
  subtitle?: unknown;
  description?: unknown;
  imageData: string;
  contentType: string;
  linkUrl?: string | null;
  buttonText?: unknown;
}

interface HeroCarouselProps {
  banners: Banner[];
  autoPlayInterval?: number;
  showArrows?: boolean;
  showDots?: boolean;
}

export function HeroCarousel({
  banners,
  autoPlayInterval = 5000,
  showArrows = true,
  showDots = true,
}: HeroCarouselProps) {
  const locale = useLocale();
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Precompute image URLs to avoid recalculating on each render
  const imageUrls = useMemo(
    () => banners.map((b) => `data:${b.contentType};base64,${b.imageData}`),
    [banners],
  );

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning || index === current) return;
      setIsTransitioning(true);
      setCurrent(index);
      // Allow transition to complete
      setTimeout(() => setIsTransitioning(false), 700);
    },
    [isTransitioning, current],
  );

  const goToNext = useCallback(() => {
    goToSlide((current + 1) % banners.length);
  }, [current, banners.length, goToSlide]);

  const goToPrev = useCallback(() => {
    goToSlide(current === 0 ? banners.length - 1 : current - 1);
  }, [current, banners.length, goToSlide]);

  // Auto-advance
  useEffect(() => {
    if (isPaused || banners.length <= 1) return;

    const timer = setInterval(() => {
      goToNext();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPaused, banners.length, autoPlayInterval, goToNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext]);

  if (banners.length === 0) {
    // Fallback hero - stacked on mobile, side-by-side on desktop
    return (
      <section className="relative bg-white overflow-hidden">
        <div className="flex flex-col lg:flex-row ">
          {/* Mobile Image - TOP */}
          <div className="lg:hidden aspect-[2/1] relative">
            <Image
              src="/images/banners/bannerdef.jpg"
              alt="Hero"
              fill
              className="object-cover"
              priority
              fetchPriority="high"
              sizes="(max-width: 1023px) 100vw, 0px"
              quality={70}
            />
          </div>

          {/* Text Content */}
          <div className="w-full lg:w-[30%] lg:min-w-[400px] lg:max-w-[600px] shrink-0 flex flex-col justify-center items-center lg:items-start px-6 lg:px-12 xl:px-16 py-8 lg:py-12 bg-white text-center lg:text-left">
            <div>
              <h1 className="font-display text-3xl md:text-4xl lg:text-4xl xl:text-5xl text-text leading-tight mb-6 lg:mb-8">
                Istražite našu ponudu
              </h1>
              <Button
                size="lg"
                asChild
                className="shadow-lg shadow-primary/25"
              >
                <Link href="/catalog">Pogledaj ponudu</Link>
              </Button>
            </div>
          </div>

          {/* Desktop Image - RIGHT (fills remaining space with 16:9 aspect ratio) */}
          <div className="hidden lg:block flex-1 relative aspect-[2/1]">
            <Image
              src="/images/banners/bannerdef.jpg"
              alt="Hero"
              fill
              className="object-cover object-center"
              priority
              fetchPriority="high"
              sizes="(max-width: 1023px) 100vw, 70vw"
              quality={70}
            />
          </div>
        </div>
      </section>
    );
  }

  const banner = banners[current];

  return (
    <section
      className="relative bg-white overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero baneri"
    >
      <div className="flex flex-col lg:flex-row ">
        {/* Mobile Image - TOP with crossfade */}
        <div className="lg:hidden aspect-[2/1] relative">
          {banners.map((b, index) => (
            <Image
              key={b.id}
              src={imageUrls[index]}
              alt={getLocalized(b.title, locale)}
              fill
              className={cn(
                "object-cover transition-opacity duration-700 ease-in-out",
                index === current ? "opacity-100 z-10" : "opacity-0 z-0",
              )}
              priority={index === 0}
              fetchPriority={index === 0 ? "high" : "auto"}
              sizes="(max-width: 1023px) 100vw, 0px"
              quality={70}
            />
          ))}
          {/* Mobile Navigation Dots - overlay on image */}
          {showDots && banners.length > 1 && (
            <div
              className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20"
              role="tablist"
            >
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300",
                    index === current
                      ? "bg-white w-7"
                      : "bg-white/50 hover:bg-white/70 w-2.5",
                  )}
                  role="tab"
                  aria-selected={index === current}
                  aria-label={`Prikaz banera ${index + 1} od ${banners.length}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Text Content with smooth transition */}
        <div className="w-full lg:w-[30%] lg:min-w-[400px] lg:max-w-[600px] shrink-0 flex flex-col justify-center items-center lg:items-start px-6 lg:px-12 xl:px-16 py-8 lg:py-12 bg-white relative overflow-hidden text-center lg:text-left">
          {banners.map((b, index) => (
            <div
              key={b.id}
              className={cn(
                "transition-all duration-500 ease-out",
                index === current
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4 absolute inset-0 pointer-events-none px-6 lg:px-10 xl:px-12 py-8 lg:py-16 flex flex-col justify-center items-center lg:items-start text-center lg:text-left",
              )}
            >
              <h1 className="font-display text-3xl md:text-4xl lg:text-4xl xl:text-5xl text-text leading-tight mb-4 lg:mb-6">
                {getLocalized(b.title, locale)}
              </h1>

              {(getLocalized(b.description, locale) || getLocalized(b.subtitle, locale)) && (
                <p className="text-base lg:text-lg text-text-muted mb-6 lg:mb-8 leading-relaxed">
                  {getLocalized(b.description, locale) || getLocalized(b.subtitle, locale)}
                </p>
              )}

              {b.linkUrl && (
                <div className="flex justify-center lg:justify-start w-full">
                  <Button
                    size="lg"
                    asChild
                    className="shadow-lg shadow-primary/25"
                  >
                    <Link href={b.linkUrl}>
                      {getLocalized(b.buttonText, locale) || "Saznaj više"}
                    </Link>
                  </Button>
                </div>
              )}

              {/* Dots inside text area on desktop */}
              {showDots && banners.length > 1 && index === current && (
                <div className="hidden lg:flex gap-2 mt-10" role="tablist">
                  {banners.map((_, dotIndex) => (
                    <button
                      key={dotIndex}
                      onClick={() => goToSlide(dotIndex)}
                      className={cn(
                        "h-2.5 rounded-full transition-all duration-300",
                        dotIndex === current
                          ? "bg-primary w-7"
                          : "bg-gray-300 hover:bg-gray-400 w-2.5",
                      )}
                      role="tab"
                      aria-selected={dotIndex === current}
                      aria-label={`Prikaz banera ${dotIndex + 1} od ${
                        banners.length
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop Image - RIGHT (fills remaining space with 16:9 aspect ratio) with crossfade */}
        <div className="hidden lg:block flex-1 relative aspect-[2/1]">
          {banners.map((b, index) => (
            <Image
              key={b.id}
              src={imageUrls[index]}
              alt={getLocalized(b.title, locale)}
              fill
              className={cn(
                "object-cover object-center transition-opacity duration-700 ease-in-out",
                index === current ? "opacity-100 z-10" : "opacity-0 z-0",
              )}
              priority={index === 0}
              fetchPriority={index === 0 ? "high" : "auto"}
              sizes="(max-width: 1023px) 100vw, 70vw"
              quality={70}
            />
          ))}
        </div>
      </div>

      {/* Arrow Navigation - positioned on the image side (desktop only) */}
      {showArrows && banners.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="hidden lg:flex absolute left-[max(30%,400px)] ml-4 top-1/2 -translate-y-1/2 z-30
                       bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg
                       hover:bg-white hover:scale-105 transition-transform duration-200
                       focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Prethodni baner"
          >
            <ChevronLeft className="w-5 h-5 text-text" />
          </button>
          <button
            onClick={goToNext}
            className="hidden lg:flex absolute right-6 top-1/2 -translate-y-1/2 z-30
                       bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg
                       hover:bg-white hover:scale-105 transition-transform duration-200
                       focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Sledeći baner"
          >
            <ChevronRight className="w-5 h-5 text-text" />
          </button>
        </>
      )}
    </section>
  );
}

export default HeroCarousel;
