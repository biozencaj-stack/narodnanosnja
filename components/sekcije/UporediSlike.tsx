"use client";

import { useId, useState } from "react";
import Image from "next/image";

/**
 * Poređenje pre/posle sa klizačem — WoodMart „Compare images“.
 *
 * Klizač je pravi `input[type=range]`, ne prevlačenje mišem: tako radi i sa
 * tastature i sa čitačem ekrana, bez ijedne linije koda za pristupačnost.
 * Prevlačenje bez toga izgleda bolje na demou i ne može se koristiti bez miša.
 *
 * Otkrivanje ide preko `clip-path`, ne preko širine: menjanje širine bi
 * skaliralo gornju sliku, pa se dve slike ne bi poklapale u tački reza.
 */
export function UporediSlike({
  pre,
  posle,
  altPre,
  altPosle,
  natpisPre,
  natpisPosle,
}: {
  pre: string;
  posle: string;
  altPre: string;
  altPosle: string;
  natpisPre: string;
  natpisPosle: string;
}) {
  const id = useId();
  const [procenat, setProcenat] = useState(50);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border">
        <Image
          src={posle}
          alt={altPosle}
          fill
          sizes="(max-width: 1023px) 100vw, 768px"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - procenat}% 0 0)` }}
        >
          <Image
            src={pre}
            alt={altPre}
            fill
            sizes="(max-width: 1023px) 100vw, 768px"
            className="object-cover"
          />
        </div>
        <span
          aria-hidden="true"
          style={{ left: `${procenat}%` }}
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90 shadow"
        />
      </div>

      <label htmlFor={id} className="block text-center text-sm text-text-muted">
        {natpisPre} ↔ {natpisPosle}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={procenat}
        onChange={(dogadjaj) => setProcenat(Number(dogadjaj.target.value))}
        className="w-full accent-primary"
        aria-valuetext={`${procenat}% prikazano stanje „${natpisPre}”`}
      />
    </div>
  );
}
