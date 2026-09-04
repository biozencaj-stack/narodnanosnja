import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Modul se namerno ne uvozi — uvoz bi povukao Prisma klijenta i tražio bazu.
 * Proverava se izvorni tekst, jer je pravilo koje se čuva pravilo o tome šta
 * fajl SME da sadrži.
 */
const IZVOR = readFileSync(new URL("./blok-proizvoda.ts", import.meta.url), "utf8");
const IZVOR_TAKSONOMIJE = readFileSync(
  new URL("./taksonomija.ts", import.meta.url),
  "utf8",
);

test("upiti bloka nisu Server Actions", () => {
  // `"use server"` na vrhu fajla pretvara svaki izvoz u javnu krajnju tačku
  // koju bilo ko sa interneta može pozvati POST zahtevom, sa argumentima koje
  // sam izabere. Zato ovi upiti i ne žive u `lib/products.ts`.
  for (const [ime, izvor] of [
    ["blok-proizvoda.ts", IZVOR],
    ["taksonomija.ts", IZVOR_TAKSONOMIJE],
  ] as const) {
    assert.equal(
      /^\s*["']use server["']/m.test(izvor),
      false,
      `${ime} ne sme imati "use server"`,
    );
  }
});

test("blok ne uvozi `lib/products`, da ne oživi tu granicu posredno", () => {
  assert.equal(/from\s+["']@\/lib\/products["']/.test(IZVOR), false);
});

test("upit ide kroz React `cache`, da dva ista bloka daju jedan upit", () => {
  assert.match(IZVOR, /import \{ cache \} from "react"/);
  assert.match(IZVOR, /cache\(async \(kljuc: string\)/);
});

test("keširana funkcija prima string, ne objekat", () => {
  // `cache()` pamti po identitetu argumenata: dva jednaka ali različita
  // objekta ne bi pogodila isti unos, pa bi „jedan upit umesto dva“ tiho
  // prestalo da važi.
  assert.match(IZVOR, /ucitajPoKljucu\(kljucUpita\(upit\)\)/);
});

test("kartica ne nosi `Decimal` preko granice servera i klijenta", () => {
  assert.match(IZVOR, /price: Number\(red\.price\)/);
  assert.match(IZVOR, /salePrice: red\.salePrice === null \? null : Number\(red\.salePrice\)/);
});
