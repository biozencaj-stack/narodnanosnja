"use client";

import { useState, useSyncExternalStore } from "react";
import { DugmePauze } from "@/components/ui/DugmePauze";

/**
 * Pokretna traka sa obaveznim dugmetom za pauzu.
 *
 * Kretanje traje duže od pet sekundi, pa WCAG 2.2.2 traži vidljiv mehanizam za
 * zaustavljanje. „Pauza na hover“ ga NE ispunjava: na dodirnom ekranu hover ne
 * postoji, a tastatura ga ne pokreće. Zato je dugme deo komponente i ne može se
 * isključiti iz admin panela.
 *
 * Uz `prefers-reduced-motion` traka kreće zaustavljena. Podešavanje se čita
 * kroz `useSyncExternalStore`, sa serverskim snimkom `false`: server ne zna
 * podešavanje posetioca, pa bi računanje pri prvom iscrtavanju oborilo
 * hidraciju. Posetilac koji dugmetom pokrene traku ima prednost nad
 * podešavanjem — izbor koji je upravo napravio ne sme da se poništi sam.
 *
 * Sadržaj se ponavlja tri puta jer `@keyframes marquee` pomera za −33.33%; sve
 * kopije osim prve su `aria-hidden`, da čitač ekrana ne pročita isti spisak tri
 * puta.
 */
const UPIT_MANJE_KRETANJA = "(prefers-reduced-motion: reduce)";

function pretplati(osvezi: () => void): () => void {
  const upit = window.matchMedia(UPIT_MANJE_KRETANJA);
  upit.addEventListener("change", osvezi);
  return () => upit.removeEventListener("change", osvezi);
}

function useManjeKretanja(): boolean {
  return useSyncExternalStore(
    pretplati,
    () => window.matchMedia(UPIT_MANJE_KRETANJA).matches,
    () => false,
  );
}

export function TrakaKlizi({
  reci,
  trajanjeSekundi,
}: {
  reci: string[];
  trajanjeSekundi: number;
}) {
  const manjeKretanja = useManjeKretanja();
  const [rucno, setRucno] = useState<boolean | null>(null);
  const pauzirano = rucno ?? manjeKretanja;

  const kopija = (skriven: boolean, kljuc: string) => (
    <span key={kljuc} className="flex shrink-0" aria-hidden={skriven || undefined}>
      {reci.map((rec, i) => (
        <span key={i} className="flex items-center">
          <span className="px-6 font-display text-[1.05rem] font-semibold">{rec}</span>
          <span aria-hidden="true" className="text-zlatna">
            ✦
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className="animate-marquee flex whitespace-nowrap"
          style={{
            animationDuration: `${trajanjeSekundi}s`,
            animationPlayState: pauzirano ? "paused" : "running",
          }}
        >
          {kopija(false, "prva")}
          {kopija(true, "druga")}
          {kopija(true, "treca")}
        </div>
      </div>
      <DugmePauze
        pauzirano={pauzirano}
        onPrebaci={() => setRucno(!pauzirano)}
        naziv="pokretnu traku"
        className="shrink-0"
      />
    </div>
  );
}
