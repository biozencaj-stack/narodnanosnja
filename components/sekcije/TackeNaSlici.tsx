"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPriceWithCurrency } from "@/lib/utils/format";
import { getLocalized } from "@/lib/i18n/localized";
import type { KarticaProizvoda } from "@/lib/db/blok-proizvoda";

/**
 * Fotografija sa klikabilnim tačkama — WoodMart „Image Hotspot“.
 *
 * Tačka je pravo dugme, ne `div` sa `onClick`: tako je dohvatljiva tastaturom i
 * čitač ekrana je najavi kao dugme sa imenom proizvoda. Mini kartica se
 * pojavljuje na klik, ne na hover — hover ne postoji na dodirnom ekranu.
 *
 * Cena stiže sa servera pri prikazu; sekcija je NE pamti, kao ni blok proizvoda.
 */
export function TackeNaSlici({
  slika,
  alt,
  tacke,
  jezik,
}: {
  slika: string;
  alt: string;
  tacke: { x: number; y: number; proizvod: KarticaProizvoda }[];
  jezik: string;
}) {
  const [otvorena, setOtvorena] = useState<number | null>(null);

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border">
        <Image
          src={slika}
          alt={alt}
          fill
          sizes="(max-width: 1023px) 100vw, 896px"
          className="object-cover"
        />

        {tacke.map((tacka, i) => {
          const naziv = getLocalized(tacka.proizvod.name, jezik);
          const cena = tacka.proizvod.salePrice ?? tacka.proizvod.price;
          const otvoreno = otvorena === i;
          return (
            <div
              key={tacka.proizvod.id}
              style={{ left: `${tacka.x}%`, top: `${tacka.y}%` }}
              className="absolute"
            >
              <button
                type="button"
                onClick={() => setOtvorena(otvoreno ? null : i)}
                aria-expanded={otvoreno}
                aria-label={`${naziv} — ${formatPriceWithCurrency(cena)}`}
                className="-ml-4 -mt-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-lg font-bold text-white shadow-lg transition-transform hover:scale-110"
              >
                <span aria-hidden="true">{otvoreno ? "×" : "+"}</span>
              </button>

              {otvoreno && (
                <div className="absolute left-1/2 top-6 z-10 w-52 -translate-x-1/2 rounded-xl border border-border bg-povrsina p-3 text-left shadow-xl">
                  <Link href={`/product/${tacka.proizvod.slug}`} className="block">
                    <span className="block text-[0.9rem] font-semibold leading-snug text-text">
                      {naziv}
                    </span>
                    <span className="mt-1 block text-[0.95rem] font-bold text-primary">
                      {formatPriceWithCurrency(cena)}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
