'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  avatar?: string;
}

const defaultTestimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Ana Petrović',
    role: 'Redovan kupac',
    content: 'Oduševljena sam kvalitetom proizvoda i brzinom isporuke. Svaka preporuka za ovu prodavnicu!',
    rating: 5,
  },
  {
    id: '2',
    name: 'Marko Jovanović',
    role: 'Redovan kupac',
    content: 'Odličan izbor proizvoda po fer cenama. Korisnička podrška je izuzetna — uvek dostupni i ljubazni.',
    rating: 5,
  },
  {
    id: '3',
    name: 'Jelena Nikolić',
    role: 'Novi kupac',
    content: 'Prvo iskustvo online kupovine kod njih i potpuno sam zadovoljna. Proizvod je stigao brzo i tačno kako je opisano.',
    rating: 4,
  },
  {
    id: '4',
    name: 'Stefan Đorđević',
    role: 'Redovan kupac',
    content: 'Već godinu dana kupujem ovde. Kvalitet je uvek na nivou, a akcije su prave. Topla preporuka!',
    rating: 5,
  },
];

interface TestimonialsProps {
  testimonials?: Testimonial[];
}

export function Testimonials({ testimonials = defaultTestimonials }: TestimonialsProps) {
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const itemsPerView = { mobile: 1, tablet: 2, desktop: 3 };

  const goToNext = useCallback(() => {
    setCurrent((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const goToPrev = useCallback(() => {
    setCurrent((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  }, [testimonials.length]);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(goToNext, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, goToNext]);

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container-wide">
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">Utisci kupaca</p>
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-text">
            Šta kažu naši kupci
          </h2>
        </div>

        <div
          className="relative"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => {
              const isVisible =
                index === current ||
                index === (current + 1) % testimonials.length ||
                index === (current + 2) % testimonials.length;

              return (
                <div
                  key={testimonial.id}
                  className={cn(
                    'bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-border/50',
                    'transition-all duration-500',
                    index === current ? 'block' : 'hidden md:block',
                    index === (current + 1) % testimonials.length ? 'hidden md:block' : '',
                    index === (current + 2) % testimonials.length ? 'hidden lg:block' : '',
                    !isVisible && 'hidden',
                  )}
                >
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'w-4 h-4',
                          i < testimonial.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-gray-200 text-gray-200'
                        )}
                      />
                    ))}
                  </div>

                  {/* Content */}
                  <p className="text-text-muted leading-relaxed mb-6">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">{testimonial.name}</p>
                      <p className="text-xs text-text-muted">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          {testimonials.length > 3 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={goToPrev}
                className="p-2 rounded-full border border-border hover:bg-background-alt transition-colors"
                aria-label="Prethodni"
              >
                <ChevronLeft className="w-5 h-5 text-text-muted" />
              </button>

              <div className="flex gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrent(index)}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      index === current ? 'bg-primary w-6' : 'bg-border w-2 hover:bg-border-dark'
                    )}
                    aria-label={`Recenzija ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={goToNext}
                className="p-2 rounded-full border border-border hover:bg-background-alt transition-colors"
                aria-label="Sledeći"
              >
                <ChevronRight className="w-5 h-5 text-text-muted" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
