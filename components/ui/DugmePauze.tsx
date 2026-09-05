"use client";

import { Pause, Play } from "lucide-react";

/**
 * Dugme pauza/pokreni za karusel sa autoplayem.
 *
 * Nije opcija i ne sme se sakriti: bez njega svaki autoplay duži od pet sekundi
 * pada WCAG 2.2.2. `aria-pressed` nosi stanje, a natpis se menja, pa čitač
 * ekrana kaže i šta dugme radi i u kom je stanju.
 */
export function DugmePauze({
  pauzirano,
  onPrebaci,
  naziv,
  className = "",
}: {
  pauzirano: boolean;
  onPrebaci: () => void;
  naziv: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPrebaci}
      aria-pressed={pauzirano}
      aria-label={pauzirano ? `Pokreni ${naziv}` : `Pauziraj ${naziv}`}
      className={`rounded-full border border-border p-2 text-text-muted transition-colors hover:text-text ${className}`}
    >
      {pauzirano ? (
        <Play className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Pause className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
