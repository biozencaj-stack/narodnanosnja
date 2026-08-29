'use client';

import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: number;
  suffix?: string;
  label: string;
}

const defaultStats: Stat[] = [
  { value: 5000, suffix: '+', label: 'Zadovoljnih kupaca' },
  { value: 200, suffix: '+', label: 'Brendova' },
  { value: 10000, suffix: '+', label: 'Proizvoda' },
  { value: 98, suffix: '%', label: 'Pozitivnih recenzija' },
];

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * value));
            if (progress < 1) requestAnimationFrame(animate);
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString('sr-Latn')}{suffix}
    </span>
  );
}

interface StatsSectionProps {
  stats?: Stat[];
}

export function StatsSection({ stats = defaultStats }: StatsSectionProps) {
  return (
    <section className="py-16 lg:py-20 bg-background-alt">
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-text">
            Brojevi govore
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2 transition-transform duration-300 group-hover:scale-110">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <p className="text-sm lg:text-base text-text-muted font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
