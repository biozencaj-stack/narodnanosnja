import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Modul se namerno ne uvozi — uvoz bi povukao Prisma klijenta i tražio bazu.
 * Proverava se izvorni tekst, jer je pravilo koje se čuva pravilo o tome šta
 * fajl SME da sadrži.
 */
const IZVOR = readFileSync(new URL("./jeftini-tipovi.ts", import.meta.url), "utf8");

test("upiti faze 5 nisu Server Actions", () => {
  assert.equal(/^\s*["']use server["']/m.test(IZVOR), false);
});

test("utisci uzimaju samo recenzije vezane za proizvod", () => {
  // `ProductReview.productId` je nullable. Recenzija vezana samo za ERP šifru
  // bi bez ovog filtera ušla u sekciju bez ijednog proizvoda, pa bi veza na
  // kartici vodila u prazno.
  assert.match(IZVOR, /productId: \{ not: null \}/);
});

test("utisci se ne oslanjaju na agregaciju po `productCode`", () => {
  assert.equal(/getProductReviewStats\(/.test(IZVOR), false);
});

test("pitanja traže kategoriju kao obavezan argument", () => {
  // Isti model puni chat widžet. Bez filtera bi svako pitanje napisano za chat
  // odmah osvanulo i na stranici.
  assert.match(IZVOR, /ucitajPitanja = cache\(\s*async \(kategorija: string, koliko: number\)/);
  assert.match(IZVOR, /where: \{ active: true, category: ociscena \}/);
});

test("prazna kategorija ne postaje „sva pitanja“", () => {
  assert.match(IZVOR, /if \(ociscena\.length === 0\) return \[\];/);
});

test("odgovor iz baze prolazi kroz allow-listu i na granici čitanja", () => {
  assert.match(IZVOR, /import \{ sanitizeRichHtml \}/);
  assert.match(IZVOR, /odgovor: sanitizeRichHtml\(red\.answer\)/);
});

test("svaki upit ide kroz React `cache`", () => {
  for (const ime of [
    "ucitajPitanja",
    "ucitajClanke",
    "ucitajUtiske",
    "ucitajNajbliziIstekAkcije",
  ]) {
    assert.match(IZVOR, new RegExp(`export const ${ime} = cache\\(`), ime);
  }
});
