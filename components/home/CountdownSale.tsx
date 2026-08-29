'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date().getTime();
  const diff = targetDate.getTime() - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tabular-nums">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-xs sm:text-sm text-white/70 mt-2 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

interface CountdownSaleProps {
  targetDate?: Date;
  title?: string;
  subtitle?: string;
  href?: string;
}

export function CountdownSale({
  targetDate,
  title = 'Sezonsko sniženje',
  subtitle = 'Ne propustite najbolje ponude — ograničeno vreme!',
  href = '/catalog?sale=true',
}: CountdownSaleProps) {
  const defaultTarget = new Date();
  defaultTarget.setDate(defaultTarget.getDate() + 7);
  const target = targetDate || defaultTarget;

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft(target));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(target));
    }, 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!mounted) {
    return (
      <section className="py-16 lg:py-20 bg-gradient-to-br from-primary via-primary-hover to-primary-dark">
        <div className="container-wide text-center">
          <div className="h-48" />
        </div>
      </section>
    );
  }

  const isExpired =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  if (isExpired) return null;

  return (
    <section className="py-16 lg:py-20 bg-gradient-to-br from-primary via-primary-hover to-primary-dark relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full" />

      <div className="container-wide relative z-10">
        <div className="text-center">
          <p className="text-sm font-medium text-white/60 uppercase tracking-widest mb-3">
            Ograničena ponuda
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-white mb-3">
            {title}
          </h2>
          <p className="text-base lg:text-lg text-white/70 mb-10 max-w-xl mx-auto">
            {subtitle}
          </p>

          {/* Countdown */}
          <div className="flex justify-center gap-3 sm:gap-4 lg:gap-6 mb-10">
            <TimeBlock value={timeLeft.days} label="Dana" />
            <TimeBlock value={timeLeft.hours} label="Sati" />
            <TimeBlock value={timeLeft.minutes} label="Min" />
            <TimeBlock value={timeLeft.seconds} label="Sek" />
          </div>

          <Button
            size="lg"
            asChild
            className="bg-white !text-primary hover:bg-white/90 shadow-xl shadow-black/20"
          >
            <Link href={href}>Pogledaj ponudu</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
