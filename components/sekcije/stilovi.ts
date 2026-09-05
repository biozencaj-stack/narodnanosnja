/**
 * Prevod nabrojanih vrednosti iz konfiguracije u fiksne Tailwind klase.
 *
 * Ovo je jedino mesto gde se to radi. U bazi nikad ne stoji ni CSS, ni ime
 * klase, ni HEX — samo ključ iz zatvorene liste. Zato admin ne može da napiše
 * proizvoljan stil, a promena izgleda je izmena ovog fajla, ne migracija.
 */

import {
  TOKENI_UKRASA,
  type TokenPozadine,
  type TokenUkrasa,
} from "@/lib/sekcije/polja";
import type { Animacija, Razmak } from "@/lib/sekcije/okvir";

/** Vertikalni razmak. Vrednosti su preuzete sa zatečene početne stranice. */
export const KLASE_RAZMAKA: Record<Razmak, string> = {
  bez: "",
  uzak: "py-10 lg:py-12",
  srednji: "py-14 lg:py-20",
  visok: "py-16 lg:py-20",
  uvodni: "py-14 lg:py-24",
};

export const KLASE_POZADINE: Record<TokenPozadine, string> = {
  podloga: "bg-background",
  podlogaAlt: "bg-background-alt",
  povrsina: "bg-povrsina",
  tamna: "bg-text text-white",
};

/** Boja glavnog teksta, po shemi koju određuje pozadina. */
export const KLASE_NASLOVA: Record<"tamna" | "svetla", string> = {
  tamna: "text-text",
  svetla: "text-[#fdf6e8]",
};

export const KLASE_PRIGUSENOG: Record<"tamna" | "svetla", string> = {
  tamna: "text-text-muted",
  svetla: "text-[#ddcdb4]",
};

/** Nadnaslov je zlatan; na tamnoj podlozi treba jača zlatna da bi se video. */
export const KLASE_NADNASLOVA: Record<"tamna" | "svetla", string> = {
  tamna: "text-zlatna",
  svetla: "text-zlatna-jaka",
};

/** Shema pisma za datu pozadinu — „svetla“ znači svetlo pismo na tamnom. */
export function shemaZa(pozadina: TokenPozadine): "tamna" | "svetla" {
  return pozadina === "tamna" ? "svetla" : "tamna";
}

/**
 * Ulazna animacija. Klase su statične da ih Tailwind vidi u izvoru; sam
 * pokretač je `components/sekcije/UOkviru.tsx`, koji dodatno proverava
 * `prefers-reduced-motion` u JavaScript-u — globalni CSS blok gasi samo
 * trajanje animacije, ne i kod koji je pokreće.
 */
export const KLASE_ANIMACIJE: Record<Animacija, string> = {
  bez: "",
  blago: "sekcija-ulaz-blago",
  odozdo: "sekcija-ulaz-odozdo",
};

/**
 * Mreže se razlikuju po prikazu, ne samo po broju kolona: traka vrednosti
 * prelazi sa dve na četiri kolone tek na `lg`, kartice se lome na `md`, a
 * koraci izrade kreću od jedne kolone na telefonu. Vrednosti su preuzete sa
 * zatečene početne stranice, pa jedan zajednički skup klasa ne bi bio tačan
 * ni na jednoj tački preloma.
 */
type VrstaMreze = "traka" | "kartice" | "koraci" | "proizvodi";

const MREZE: Record<VrstaMreze, { razmak: string; kolone: Record<string, string> }> = {
  traka: {
    razmak: "gap-x-6 gap-y-8",
    kolone: {
      "2": "grid-cols-2",
      "3": "grid-cols-2 lg:grid-cols-3",
      "4": "grid-cols-2 lg:grid-cols-4",
    },
  },
  kartice: {
    razmak: "gap-4 lg:gap-6",
    kolone: {
      "2": "grid-cols-2",
      "3": "grid-cols-2 md:grid-cols-3",
      "4": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    },
  },
  koraci: {
    razmak: "gap-8 lg:gap-10",
    kolone: {
      "2": "sm:grid-cols-2",
      "3": "sm:grid-cols-2 lg:grid-cols-3",
      "4": "sm:grid-cols-2 lg:grid-cols-4",
    },
  },
  proizvodi: {
    razmak: "gap-4 lg:gap-6",
    kolone: {
      "2": "grid-cols-2",
      "3": "grid-cols-2 md:grid-cols-3",
      "4": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    },
  },
};

/**
 * Mreža i klizač bloka proizvoda, sa zasebnim brojem kolona na telefonu.
 *
 * Tailwind ne vidi klase sastavljene u vreme izvršavanja, pa se svaka
 * kombinacija ispisuje doslovno. Kombinacija „2 na telefonu” daje tačno one
 * klase koje je blok imao pre faze 4, pa zatečeni redovi izgledaju isto.
 */
const MREZA_PROIZVODA: Record<string, Record<string, string>> = {
  "1": {
    "2": "grid-cols-1 sm:grid-cols-2",
    "3": "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    "4": "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  },
  "2": {
    "2": "grid-cols-2",
    "3": "grid-cols-2 md:grid-cols-3",
    "4": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  },
};

const KLIZAC_PROIZVODA: Record<string, Record<string, string>> = {
  "1": {
    "2": "basis-full sm:basis-1/2",
    "3": "basis-full sm:basis-1/2 md:basis-1/3",
    "4": "basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4",
  },
  "2": {
    "2": "basis-1/2",
    "3": "basis-1/2 md:basis-1/3",
    "4": "basis-1/2 md:basis-1/3 lg:basis-1/4",
  },
};

export function klaseMrezeProizvoda(kolone: string, koloneMobilno: string): string {
  const red = MREZA_PROIZVODA[koloneMobilno] ?? MREZA_PROIZVODA["2"];
  return spoji("grid", MREZE.proizvodi.razmak, red[kolone] ?? red["4"]);
}

/** Širina jednog polja klizača. Razmak nosi `pl-*` na samom polju. */
export function klaseKlizacaProizvoda(kolone: string, koloneMobilno: string): string {
  const red = KLIZAC_PROIZVODA[koloneMobilno] ?? KLIZAC_PROIZVODA["2"];
  return spoji("min-w-0 shrink-0 grow-0", red[kolone] ?? red["4"]);
}

export function klaseMreze(vrsta: VrstaMreze, kolone: string): string {
  const mreza = MREZE[vrsta];
  return spoji("grid", mreza.razmak, mreza.kolone[kolone] ?? mreza.kolone["4"]);
}

export function bojaUkrasa(token: unknown): string {
  if (typeof token === "string" && token in TOKENI_UKRASA) {
    return TOKENI_UKRASA[token as TokenUkrasa];
  }
  return TOKENI_UKRASA.zlatna;
}

/** Spaja klase i izbacuje prazne, bez dodatne zavisnosti. */
export function spoji(...delovi: (string | false | null | undefined)[]): string {
  return delovi.filter(Boolean).join(" ");
}
