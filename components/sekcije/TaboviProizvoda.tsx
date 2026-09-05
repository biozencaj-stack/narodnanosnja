"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

/**
 * Tabovi bloka proizvoda.
 *
 * Sadržaj svakog taba dolazi sa servera već iscrtan i ostaje u dokumentu — samo
 * se skriva. Tako prelazak između tabova ne pravi novi zahtev, a pretraživač i
 * čitač ekrana vide sve proizvode. Skrivanje ide preko `hidden` atributa, ne
 * preko klase, da sadržaj zaista izađe iz stabla pristupačnosti.
 *
 * Tastatura: strelice levo/desno menjaju tab, kao što `tablist` obrazac traži.
 * Neaktivni tabovi imaju `tabIndex={-1}`, pa Tab vodi pravo u sadržaj.
 */
export function TaboviProizvoda({
  tabovi,
}: {
  tabovi: { kljuc: string; naslov: string; sadrzaj: ReactNode }[];
}) {
  const osnova = useId();
  const [aktivan, setAktivan] = useState(0);

  function naTaster(dogadjaj: React.KeyboardEvent<HTMLButtonElement>) {
    const smer =
      dogadjaj.key === "ArrowRight" ? 1 : dogadjaj.key === "ArrowLeft" ? -1 : 0;
    if (smer === 0) return;
    dogadjaj.preventDefault();
    const sledeci = (aktivan + smer + tabovi.length) % tabovi.length;
    setAktivan(sledeci);
    document.getElementById(`${osnova}-tab-${sledeci}`)?.focus();
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Izbor grupe proizvoda"
        className="flex flex-wrap justify-center gap-2"
      >
        {tabovi.map((tab, indeks) => (
          <button
            key={tab.kljuc}
            id={`${osnova}-tab-${indeks}`}
            role="tab"
            type="button"
            aria-selected={indeks === aktivan}
            aria-controls={`${osnova}-panel-${indeks}`}
            tabIndex={indeks === aktivan ? 0 : -1}
            onClick={() => setAktivan(indeks)}
            onKeyDown={naTaster}
            className={
              indeks === aktivan
                ? "rounded-full border border-zlatna bg-zlatna/10 px-4 py-2 text-sm font-semibold text-text"
                : "rounded-full border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:text-text"
            }
          >
            {tab.naslov}
          </button>
        ))}
      </div>

      {tabovi.map((tab, indeks) => (
        <div
          key={tab.kljuc}
          id={`${osnova}-panel-${indeks}`}
          role="tabpanel"
          aria-labelledby={`${osnova}-tab-${indeks}`}
          hidden={indeks !== aktivan}
        >
          {tab.sadrzaj}
        </div>
      ))}
    </div>
  );
}
