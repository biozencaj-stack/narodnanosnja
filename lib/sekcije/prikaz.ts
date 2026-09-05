/**
 * Render granica za bogat tekst sekcije.
 *
 * `CLAUDE.md` traži da javni rich HTML prođe kroz allow-listu iz
 * `lib/security/html.ts` PRI UPISU **i ponovo na javnoj read/render granici**.
 * Ovo je ta druga granica.
 *
 * Nije suvišna: red može ući u bazu i mimo validatora — kroz seed skriptu,
 * ručni SQL, restore starijeg dampa ili kasnije pooštrenu allow-listu — i tada
 * je ovo jedino mesto koje ga zaustavlja.
 *
 * Funkcija stoji pod `lib/` da bi je `npm test` uopšte pokrenuo: skripta glasi
 * `node --import tsx --test "lib/**\/*.test.ts"` i testove izvan `lib/` ne vidi.
 * Zato komponenta koja puni `dangerouslySetInnerHTML` sme da zove isključivo
 * nju, nikad `sanitizeLocalizedRichText` ugrađen u JSX.
 */

import { sanitizeLocalizedRichText } from "@/lib/security/html";
import { citajLok } from "./polja";

/**
 * Vraća HTML spreman za `dangerouslySetInnerHTML`, na traženom jeziku.
 * Prazan string znači da nema šta da se prikaže — pozivalac tada ne renderuje
 * ni prazan omotač.
 */
export function sanitizujZaPrikaz(vrednost: unknown, jezik: string): string {
  const ocisceno = sanitizeLocalizedRichText(vrednost);
  if (!ocisceno) return "";
  return citajLok(ocisceno, jezik);
}

/**
 * Go tekst iz sanitizovanog HTML-a.
 *
 * Služi isključivo strukturiranim podacima: `FAQPage` traži `acceptedAnswer` kao
 * tekst, pa bi oznake u njemu bile i beskorisne i rizične. NIJE zamena za
 * sanitizaciju i ne sme se koristiti da bi se HTML „očistio“ — ulaz mora već
 * biti prošao kroz allow-listu.
 */
export function tekstIzHtmla(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
