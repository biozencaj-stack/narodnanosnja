"use client";

import { useState } from "react";

/**
 * Uređivač tačaka nad fotografijom.
 *
 * Tačka se postavlja KLIKOM po slici, a ne kucanjem koordinata: procenat širine
 * i visine je broj koji čovek ne ume da proceni gledajući sliku, pa bi svako
 * postavljanje bilo pogađanje pa ispravljanje.
 *
 * Vrednosti su procenti, ne pikseli — tačka tada ostaje na istom mestu i kad se
 * slika skalira na telefonu.
 *
 * Dok slika nije izabrana, ovde nema šta da se klikne; polje to i kaže umesto
 * da ponudi prazan pravougaonik.
 */

interface Tacka {
  x: number;
  y: number;
  proizvod: string;
}

function tacke(vrednost: unknown): Tacka[] {
  if (!Array.isArray(vrednost)) return [];
  return vrednost.flatMap((stavka) => {
    if (typeof stavka !== "object" || stavka === null) return [];
    const zapis = stavka as Record<string, unknown>;
    const x = typeof zapis.x === "number" ? zapis.x : null;
    const y = typeof zapis.y === "number" ? zapis.y : null;
    if (x === null || y === null) return [];
    return [{ x, y, proizvod: typeof zapis.proizvod === "string" ? zapis.proizvod : "" }];
  });
}

function putanjaSlike(vrednost: unknown): string | null {
  if (typeof vrednost !== "object" || vrednost === null) return null;
  const putanja = (vrednost as Record<string, unknown>).putanja;
  return typeof putanja === "string" && putanja.length > 0 ? putanja : null;
}

export function PoljeTackeNaSlici({
  vrednost,
  slika,
  maxStavki,
  disabled,
  onChange,
}: {
  vrednost: unknown;
  slika: unknown;
  maxStavki: number;
  disabled?: boolean;
  onChange: (tacke: Tacka[]) => void;
}) {
  const spisak = tacke(vrednost);
  const putanja = putanjaSlike(slika);
  const [izabrana, setIzabrana] = useState<number | null>(null);

  if (!putanja) {
    return (
      <p className="rounded-md border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500">
        Prvo izaberi fotografiju iznad, pa se ovde postavljaju tačke.
      </p>
    );
  }

  function dodaj(dogadjaj: React.MouseEvent<HTMLButtonElement>) {
    if (disabled || spisak.length >= maxStavki) return;
    const okvir = dogadjaj.currentTarget.getBoundingClientRect();
    // Zaokruživanje na jednu decimalu: veća preciznost ne postoji ni u kliku,
    // a čuva `config` od beskorisno dugih brojeva.
    const x = Math.round(((dogadjaj.clientX - okvir.left) / okvir.width) * 1000) / 10;
    const y = Math.round(((dogadjaj.clientY - okvir.top) / okvir.height) * 1000) / 10;
    onChange([...spisak, { x, y, proizvod: "" }]);
    setIzabrana(spisak.length);
  }

  function izmeni(indeks: number, delta: Partial<Tacka>) {
    onChange(spisak.map((tacka, i) => (i === indeks ? { ...tacka, ...delta } : tacka)));
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={dodaj}
        disabled={disabled || spisak.length >= maxStavki}
        className="relative block w-full overflow-hidden rounded-md border border-stone-300 disabled:cursor-not-allowed"
        aria-label="Klikni da dodaš tačku"
      >
        {/* Obična `img`, ne `next/image`: ovo je admin alat u kom je bitno da
            prikazana slika ima tačno iste proporcije kao original, jer se po
            njoj računaju procenti. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={putanja} alt="" className="block w-full" />
        {spisak.map((tacka, i) => (
          <span
            key={i}
            style={{ left: `${tacka.x}%`, top: `${tacka.y}%` }}
            className={
              i === izabrana
                ? "absolute -ml-3 -mt-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-stone-900 text-[0.7rem] font-bold text-white"
                : "absolute -ml-3 -mt-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 text-[0.7rem] font-bold text-white"
            }
          >
            {i + 1}
          </span>
        ))}
      </button>

      {spisak.length >= maxStavki && (
        <p className="text-xs text-stone-500">Dostignuto je najviše {maxStavki} tačaka.</p>
      )}

      {spisak.length === 0 ? (
        <p className="text-xs text-stone-500">Klikni po slici da postaviš prvu tačku.</p>
      ) : (
        <ol className="space-y-1">
          {spisak.map((tacka, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-xs text-stone-500">{i + 1}.</span>
              <input
                type="text"
                value={tacka.proizvod}
                disabled={disabled}
                placeholder="slug proizvoda"
                onFocus={() => setIzabrana(i)}
                onChange={(dogadjaj) => izmeni(i, { proizvod: dogadjaj.target.value })}
                className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm"
                aria-label={`Slug proizvoda za tačku ${i + 1}`}
              />
              <span className="shrink-0 text-xs tabular-nums text-stone-400">
                {tacka.x}% / {tacka.y}%
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange(spisak.filter((_, j) => j !== i));
                  setIzabrana(null);
                }}
                disabled={disabled}
                className="px-1 text-red-600 disabled:opacity-30"
                aria-label={`Ukloni tačku ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
