"use client";

import { useEffect, useRef, useState } from "react";

export type StanjeUlaza = "mirno" | "pripremljeno" | "prikazano";

/**
 * Prati kad element prvi put uđe u vidno polje, za ulaznu animaciju sekcije.
 *
 * Obrazac je izdvojen iz `components/home/StatsSection.tsx`, uz tri ispravke
 * koje su tamo nedostajale:
 *
 * 1. Sadržaj nikad ne kreće iz nevidljivog stanja na serveru. Prvi ispis je
 *    uvek „mirno“ — potpuno vidljiv — pa stranica bez JavaScript-a, sa
 *    neuspelom hidratacijom ili u čitaču pretraživača ostaje čitljiva.
 * 2. Pripremno (nevidljivo) stanje dobija samo element koji je JOŠ ISPOD
 *    vidnog polja. Element koji se već vidi se ne dira, pa nema treperenja
 *    kakvo ima `components/home/HeroSection.tsx`.
 * 3. Sopstvena provera `prefers-reduced-motion`. Globalni blok u
 *    `app/globals.css` skraćuje trajanje animacije, ali ne dira JavaScript koji
 *    je pokreće; bez ove provere element bi i dalje bio sakriven pa otkriven.
 *
 * Kad `IntersectionObserver` ne postoji, stanje ostaje „mirno“ — sadržaj koji
 * čeka posmatrača koji nikad ne dođe je nevidljiv sadržaj.
 */
export function useUOkviru<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [stanje, setStanje] = useState<StanjeUlaza>("mirno");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const manjeKretanja =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (manjeKretanja || typeof IntersectionObserver === "undefined") return;

    const okvir = element.getBoundingClientRect();
    if (okvir.top < window.innerHeight * 0.9) return;

    setStanje("pripremljeno");

    const posmatrac = new IntersectionObserver(
      (unosi) => {
        for (const unos of unosi) {
          if (unos.isIntersecting) {
            setStanje("prikazano");
            posmatrac.disconnect();
            return;
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    posmatrac.observe(element);
    return () => posmatrac.disconnect();
  }, []);

  return { ref, stanje };
}
