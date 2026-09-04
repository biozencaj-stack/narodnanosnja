"use client";

import { useEffect, useState } from "react";
import type { EmblaCarouselType } from "embla-carousel";

/**
 * Pauza za karusel sa autoplayem.
 *
 * WCAG 2.2.2 traži da se kretanje koje traje duže od pet sekundi može
 * zaustaviti. `stopOnInteraction` iz embla-e to NE ispunjava: on staje tek kad
 * posetilac dodirne sam sadržaj, a kriterijum traži vidljiv mehanizam koji
 * postoji i pre svakog dodira. Pauza na hover takođe ne prolazi — na dodirnom
 * ekranu hover ne postoji, a tastatura ga ne pokreće.
 *
 * Uz `prefers-reduced-motion` karusel starta pauziran: posetilac koji je tražio
 * manje kretanja ne treba prvo da ga vidi pa da ga zaustavlja. Provera je u
 * efektu, ne pri prvom iscrtavanju — server ne zna podešavanje posetioca, pa bi
 * razlika oborila hidraciju.
 */
export function usePauzaKarusela(emblaApi: EmblaCarouselType | undefined) {
  const [pauzirano, setPauzirano] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const upit = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (upit?.matches) setPauzirano(true);
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const autoplay = emblaApi.plugins().autoplay;
    if (!autoplay) return;
    if (pauzirano) autoplay.stop();
    else autoplay.play();
  }, [emblaApi, pauzirano]);

  return {
    pauzirano,
    prebaci: () => setPauzirano((prethodno) => !prethodno),
  };
}
