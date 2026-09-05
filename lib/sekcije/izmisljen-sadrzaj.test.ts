import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Izmišljen sadržaj se ne prenosi u sekcije — briše se.
 *
 * Zatečene šablonske komponente su nosile četiri kupca sa imenom i gradom koji
 * ne postoje, i obećanja koja prodavnica ne daje. Ništa od toga nije podatak
 * nego rekvizit iz teme, a rekvizit na javnom sajtu je neistina.
 *
 * Provera gleda samo prikazni sloj. Admin panel je izuzet: tamo „Besplatna
 * dostava“ nije obećanje nego naziv stvarnog tipa promocije iz `PromotionType`.
 */

const KOREN = new URL("../../", import.meta.url).pathname;

const ZABRANJENO = [
  "Podrška 24/7",
  "30 dana za zamenu",
  "Ana Petrović",
  "Jelena Nikolić",
  "Stefan Đorđević",
];

function fajlovi(putanja: string): string[] {
  const rezultat: string[] = [];
  for (const unos of readdirSync(putanja)) {
    const puna = join(putanja, unos);
    if (statSync(puna).isDirectory()) {
      if (unos === "admin" || unos === "node_modules") continue;
      rezultat.push(...fajlovi(puna));
      continue;
    }
    if (unos.endsWith(".tsx") || unos.endsWith(".ts")) rezultat.push(puna);
  }
  return rezultat;
}

test("prikazni sloj ne sadrži izmišljen sadržaj iz šablona", () => {
  const nadjeno: string[] = [];
  for (const putanja of fajlovi(join(KOREN, "components"))) {
    const sadrzaj = readFileSync(putanja, "utf8");
    for (const izraz of ZABRANJENO) {
      if (sadrzaj.includes(izraz)) {
        nadjeno.push(`${putanja.replace(KOREN, "")}: „${izraz}”`);
      }
    }
  }
  assert.deepEqual(nadjeno, [], nadjeno.join("\n"));
});

test("obrisane šablonske komponente se ne vraćaju", () => {
  // `Testimonials` je nosila izmišljene kupce, `CountdownSale` hitnost bez
  // ijedne akcije u bazi. Zamenili su ih tipovi `utisci` i `odbrojavanje`, koji
  // čitaju stvarne podatke.
  const preostale = fajlovi(join(KOREN, "components", "home")).map((p) =>
    p.slice(p.lastIndexOf("/") + 1),
  );
  for (const ime of [
    "Testimonials.tsx",
    "CountdownSale.tsx",
    "FeaturedCarousel.tsx",
    "NewArrivals.tsx",
    "BrandSlider.tsx",
  ]) {
    assert.equal(preostale.includes(ime), false, ime);
  }
});
