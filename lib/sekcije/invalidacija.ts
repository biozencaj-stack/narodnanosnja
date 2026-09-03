/**
 * Imena keš oznaka za sekcije i pravilo kada se koja poništava.
 *
 * Logika stoji pod `lib/` iz jednog razloga: `npm test` glob-uje isključivo
 * `lib/**\/*.test.ts`, pa test koji živi pored rute ne bi bio pokrenut. Pravilo
 * je čista funkcija bez uvoza `next/cache`, da test ne mora da podiže Next
 * runtime.
 */

import { OBRAZAC_KLJUCA_STRANICE } from "./polja";

/** Sve sekcije jedne stranice. Javni čitač koristi samo ovu oznaku. */
export function oznakaStranice(pageKey: string): string {
  if (!OBRAZAC_KLJUCA_STRANICE.test(pageKey)) {
    throw new RangeError(`Neispravan ključ stranice: ${pageKey}`);
  }
  return `sekcije:${pageKey}`;
}

export type RazlogInvalidacije =
  | "objava"
  | "brisanje"
  | "redosled"
  | "nacrt"
  | "vidljivost";

/**
 * Koje oznake treba poništiti posle jedne izmene.
 *
 * Čuvanje nacrta NIŠTA ne poništava — to je cela poenta nacrta. Kad bi i ono
 * čistilo keš, javna stranica bi se pregradila iz istih objavljenih podataka,
 * pa bi trošak bio besplatan samo naizgled: svaki potez u admin obrascu rušio
 * bi keš početne za sve posetioce.
 *
 * Vidljivost i redosled poništavaju keš samo kad diraju OBJAVLJENE kolone.
 * Njihove nacrt-kolone (`draftIsActive`, `draftOrder`) su isto što i nacrt.
 */
export function oznakeZaInvalidaciju(
  razlog: RazlogInvalidacije,
  pageKey: string,
): readonly string[] {
  if (razlog === "nacrt") return [];
  return [oznakaStranice(pageKey)];
}
