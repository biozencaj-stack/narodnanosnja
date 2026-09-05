"use client";

import { useEffect, useState } from "react";

/**
 * Odbrojavanje do zadatog trenutka.
 *
 * Server ne sme da iscrta preostalo vreme: između generisanja odgovora i
 * prikaza u pregledaču prođe neodređeno vreme, a `force-dynamic` stranica se i
 * dalje može zadržati u međukešu. Zato server šalje samo TRENUTAK isteka, a
 * razliku računa pregledač.
 *
 * Prvo iscrtavanje je namerno prazno i zauzima istu visinu: da se broj računa
 * već pri iscrtavanju, server i klijent bi dali različit rezultat i hidracija
 * bi pukla.
 *
 * `aria-live="off"` je namerno: promena svake sekunde bi čitač ekrana pretvorila
 * u neprekidno brojanje. Ceo preostali rok stoji u `aria-label`.
 */

interface Preostalo {
  dana: number;
  sati: number;
  minuta: number;
  sekundi: number;
}

function izracunaj(cilj: number, sada: number): Preostalo | null {
  const razlika = cilj - sada;
  if (razlika <= 0) return null;
  const sekunde = Math.floor(razlika / 1000);
  return {
    dana: Math.floor(sekunde / 86400),
    sati: Math.floor((sekunde % 86400) / 3600),
    minuta: Math.floor((sekunde % 3600) / 60),
    sekundi: sekunde % 60,
  };
}

function dva(broj: number): string {
  return broj.toString().padStart(2, "0");
}

export function Odbrojac({
  istice,
  porukaPoIsteku,
}: {
  istice: string;
  porukaPoIsteku: string;
}) {
  const cilj = new Date(istice).getTime();
  const [preostalo, setPreostalo] = useState<Preostalo | null>(null);
  const [krenulo, setKrenulo] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(cilj)) return;
    const osvezi = () => {
      setPreostalo(izracunaj(cilj, Date.now()));
      setKrenulo(true);
    };
    osvezi();
    const tajmer = setInterval(osvezi, 1000);
    return () => clearInterval(tajmer);
  }, [cilj]);

  if (krenulo && preostalo === null) {
    return <p className="text-center text-[1.05rem] font-semibold">{porukaPoIsteku}</p>;
  }

  const polja: { vrednost: string; natpis: string }[] = preostalo
    ? [
        { vrednost: String(preostalo.dana), natpis: "dana" },
        { vrednost: dva(preostalo.sati), natpis: "sati" },
        { vrednost: dva(preostalo.minuta), natpis: "minuta" },
        { vrednost: dva(preostalo.sekundi), natpis: "sekundi" },
      ]
    : [
        { vrednost: "–", natpis: "dana" },
        { vrednost: "–", natpis: "sati" },
        { vrednost: "–", natpis: "minuta" },
        { vrednost: "–", natpis: "sekundi" },
      ];

  const opis = preostalo
    ? `Preostalo ${preostalo.dana} dana, ${preostalo.sati} sati i ${preostalo.minuta} minuta`
    : "Preostalo vreme se učitava";

  return (
    <div
      className="flex flex-wrap justify-center gap-3 sm:gap-5"
      role="timer"
      aria-live="off"
      aria-label={opis}
    >
      {polja.map((polje) => (
        <div
          key={polje.natpis}
          className="min-w-[4.5rem] rounded-xl border border-zlatna/40 bg-povrsina px-4 py-3 text-center"
        >
          <span
            aria-hidden="true"
            className="block font-display text-[1.9rem] font-bold leading-none tabular-nums text-primary"
          >
            {polje.vrednost}
          </span>
          <span aria-hidden="true" className="mt-1 block text-[0.72rem] uppercase tracking-wider text-text-muted">
            {polje.natpis}
          </span>
        </div>
      ))}
    </div>
  );
}
