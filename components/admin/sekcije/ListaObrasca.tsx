"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { PoljeObrasca } from "./PoljeObrasca";
import type { PoljeSekcije } from "@/lib/sekcije/polja";

/**
 * Polje tipa `lista`: niz stavki od kojih svaka ima svoja podpolja.
 *
 * Prevlačenja nema i ne obećava se. Dugmad ▲▼ rade bez biblioteke, rade na
 * dodir i rade sa tastature — što prevlačenje po pravilu ne radi bez znatno
 * više posla nego što ova faza može da ponese.
 */

interface ListaProps {
  polje: Extract<PoljeSekcije, { tip: "lista" }>;
  vrednost: unknown;
  onChange: (vrednost: unknown) => void;
  greske?: Record<string, string>;
  disabled?: boolean;
}

function kaoStavke(vrednost: unknown): Record<string, unknown>[] {
  if (!Array.isArray(vrednost)) return [];
  return vrednost.map((stavka) =>
    typeof stavka === "object" && stavka !== null && !Array.isArray(stavka)
      ? (stavka as Record<string, unknown>)
      : {},
  );
}

export function ListaObrasca({
  polje,
  vrednost,
  onChange,
  greske = {},
  disabled = false,
}: ListaProps) {
  const stavke = kaoStavke(vrednost);
  const punaLista = stavke.length >= polje.maxStavki;

  const zameni = (sledece: Record<string, unknown>[]) => onChange(sledece);

  const pomeri = (indeks: number, pomak: number) => {
    const cilj = indeks + pomak;
    if (cilj < 0 || cilj >= stavke.length) return;
    const sledece = [...stavke];
    [sledece[indeks], sledece[cilj]] = [sledece[cilj], sledece[indeks]];
    zameni(sledece);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="block text-sm font-medium text-stone-700">
          {polje.natpis}
          <span className="ml-2 text-xs font-normal text-stone-500">
            {stavke.length} / {polje.maxStavki}
          </span>
        </label>
        <button
          type="button"
          disabled={disabled || punaLista}
          onClick={() => zameni([...stavke, {}])}
          className="flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Dodaj {polje.natpisStavke.toLowerCase()}
        </button>
      </div>

      {polje.opis && <p className="text-xs text-stone-500">{polje.opis}</p>}

      {stavke.length === 0 && (
        <p className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-xs text-stone-500">
          Nema nijedne stavke. Sekcija se u ovom stanju ne prikazuje.
        </p>
      )}

      {stavke.map((stavka, indeks) => (
        <div
          key={indeks}
          className="rounded-lg border border-stone-200 bg-stone-50 p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600">
              {polje.natpisStavke} {indeks + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Pomeri gore"
                disabled={disabled || indeks === 0}
                onClick={() => pomeri(indeks, -1)}
                className="rounded p-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Pomeri dole"
                disabled={disabled || indeks === stavke.length - 1}
                onClick={() => pomeri(indeks, 1)}
                className="rounded p-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Obriši ${polje.natpisStavke.toLowerCase()} ${indeks + 1}`}
                disabled={disabled}
                onClick={() =>
                  zameni(stavke.filter((_, redni) => redni !== indeks))
                }
                className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {polje.stavka.map((podpolje) => (
              <PoljeObrasca
                key={podpolje.kljuc}
                polje={podpolje}
                vrednost={stavka[podpolje.kljuc]}
                disabled={disabled}
                greska={greske[`${polje.kljuc}[${indeks}].${podpolje.kljuc}`]}
                onChange={(nova) => {
                  const sledece = [...stavke];
                  sledece[indeks] = { ...stavka, [podpolje.kljuc]: nova };
                  zameni(sledece);
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
