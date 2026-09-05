"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Brojač koji odbroji do svoje vrednosti kad uđe u vidno polje.
 *
 * Konačna vrednost je već u HTML-u sa servera i to se ne menja: posetilac bez
 * JavaScript-a, čitač ekrana i pretraživač vide broj odmah. Animacija je samo
 * dopuna preko toga.
 *
 * Uz `prefers-reduced-motion` brojanja nema. Uz vrednost koja nije broj —
 * „od 1893“, „24/7“ — takođe nema: tekst se prikazuje kakav jeste, umesto da
 * se pogađa šta je u njemu broj.
 */
const TRAJANJE_MS = 1200;

function razlozi(tekst: string): { broj: number; pre: string; posle: string } | null {
  const pogodak = tekst.match(/^(\D*?)(\d+)(\D*)$/);
  if (!pogodak) return null;
  const broj = Number.parseInt(pogodak[2], 10);
  if (!Number.isFinite(broj)) return null;
  return { broj, pre: pogodak[1], posle: pogodak[3] };
}

export function Brojac({ vrednost, className }: { vrednost: string; className?: string }) {
  const [prikaz, setPrikaz] = useState(vrednost);
  const element = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const delovi = razlozi(vrednost);
    if (!delovi || delovi.broj === 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const cilj = element.current;
    if (!cilj) return;

    let animacija = 0;
    const posmatrac = new IntersectionObserver(
      (unosi) => {
        if (!unosi.some((unos) => unos.isIntersecting)) return;
        posmatrac.disconnect();

        const pocetak = performance.now();
        const korak = (sada: number) => {
          const udeo = Math.min((sada - pocetak) / TRAJANJE_MS, 1);
          // Usporavanje na kraju; linearno brojanje izgleda kao kvar.
          const olaksano = 1 - Math.pow(1 - udeo, 3);
          const tekuci = Math.round(delovi.broj * olaksano);
          setPrikaz(`${delovi.pre}${tekuci}${delovi.posle}`);
          if (udeo < 1) animacija = requestAnimationFrame(korak);
        };
        animacija = requestAnimationFrame(korak);
      },
      { threshold: 0.4 },
    );

    posmatrac.observe(cilj);
    return () => {
      posmatrac.disconnect();
      if (animacija) cancelAnimationFrame(animacija);
    };
  }, [vrednost]);

  return (
    <span ref={element} className={className}>
      {prikaz}
    </span>
  );
}
