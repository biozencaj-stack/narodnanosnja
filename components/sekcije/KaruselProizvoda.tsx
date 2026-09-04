"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LocalProductCard } from "@/components/product/LocalProductCard";
import { DugmePauze } from "@/components/ui/DugmePauze";
import { usePauzaKarusela } from "@/hooks/usePauzaKarusela";
import type { KarticaProizvoda } from "@/lib/db/blok-proizvoda";
import { klaseKlizacaProizvoda } from "./stilovi";

/**
 * Klizni prikaz bloka proizvoda.
 *
 * Autoplay traje duže od pet sekundi, pa dugme za pauzu nije ukras nego uslov
 * WCAG 2.2.2 — vidi `usePauzaKarusela`. Strelice postoje uz njega, jer klizanje
 * prstom ne postoji na tastaturi.
 */
export function KaruselProizvoda({
  proizvodi,
  kolone,
  koloneMobilno,
  prikaziOznake,
  naziv,
}: {
  proizvodi: KarticaProizvoda[];
  kolone: string;
  koloneMobilno: string;
  prikaziOznake: boolean;
  naziv: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: "start", loop: proizvodi.length > Number(kolone), containScroll: "trimSnaps" },
    [Autoplay({ delay: 5000, stopOnInteraction: true })],
  );
  const pauza = usePauzaKarusela(emblaApi);
  const [mozeNazad, setMozeNazad] = useState(false);
  const [mozeNapred, setMozeNapred] = useState(false);

  const osvezi = useCallback((api: NonNullable<typeof emblaApi>) => {
    setMozeNazad(api.canScrollPrev());
    setMozeNapred(api.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    osvezi(emblaApi);
    emblaApi.on("select", osvezi).on("reInit", osvezi);
    return () => {
      emblaApi.off("select", osvezi).off("reInit", osvezi);
    };
  }, [emblaApi, osvezi]);

  const klasaPolja = klaseKlizacaProizvoda(kolone, koloneMobilno);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden" ref={emblaRef}>
        {/* Negativna margina poništava `pl-*` prvog polja, da red počne uz ivicu. */}
        <div className="-ml-4 flex lg:-ml-6">
          {proizvodi.map((proizvod) => (
            <div key={proizvod.id} className={`${klasaPolja} pl-4 lg:pl-6`}>
              <LocalProductCard product={proizvod} prikaziOznake={prikaziOznake} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <DugmePauze
          pauzirano={pauza.pauzirano}
          onPrebaci={pauza.prebaci}
          naziv={naziv}
        />
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!mozeNazad}
          aria-label={`${naziv}: prethodni proizvodi`}
          className="rounded-full border border-border p-2 text-text-muted transition-colors hover:text-text disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          disabled={!mozeNapred}
          aria-label={`${naziv}: sledeći proizvodi`}
          className="rounded-full border border-border p-2 text-text-muted transition-colors hover:text-text disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
