import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { STATICKE_STRANICE } from "./staticke-stranice";

/**
 * Spisak statičkih stranica mora da odgovara stvarnim rutama pod `app/`.
 *
 * Pre faze 7 je bio tvrdo upisan u `app/sitemap.ts` i već je odstupao:
 * `/karijera` u njemu nije bio, a kategorije su izlazile kao `/catalog?category=`,
 * adresa koju katalog nikad nije čitao. Mapa sajta koja pokazuje na 404 ili na
 * duplikat je gora od mape koje nema — pretraživač joj veruje.
 */
const KOREN = new URL("../../", import.meta.url).pathname;

/** Grupe rutiranja (`(shop)`, `(legal)`) ne postoje u adresi. */
const GRUPE = ["(shop)", "(legal)", "(auth)", "(user)"];

function rutaPostoji(putanja: string): boolean {
  const segment = putanja === "" ? "" : putanja.replace(/^\//, "");
  for (const grupa of GRUPE) {
    if (existsSync(join(KOREN, "app", grupa, segment, "page.tsx"))) return true;
  }
  return existsSync(join(KOREN, "app", segment, "page.tsx"));
}

test("svaka statička stranica iz mape sajta ima stvarnu rutu", () => {
  const nedostaju = STATICKE_STRANICE.filter(
    (stranica) => !rutaPostoji(stranica.putanja),
  ).map((stranica) => stranica.putanja || "/");
  assert.deepEqual(nedostaju, [], `nema rute za: ${nedostaju.join(", ")}`);
});

test("putanje su jedinstvene i bez završne kose crte", () => {
  const putanje = STATICKE_STRANICE.map((stranica) => stranica.putanja);
  assert.equal(new Set(putanje).size, putanje.length, "putanja se ponavlja");
  for (const putanja of putanje) {
    if (putanja === "") continue;
    assert.match(putanja, /^\/[a-z0-9-/]+$/, putanja);
    assert.equal(putanja.endsWith("/"), false, putanja);
  }
});

test("privatni tokovi i pretraga nisu u mapi sajta", () => {
  // Korpa i plaćanje su privatni tokovi koje `robots.ts` i zabranjuje; pretraga
  // je beskonačan prostor adresa bez sopstvenog sadržaja.
  const putanje = new Set(STATICKE_STRANICE.map((stranica) => stranica.putanja));
  for (const zabranjena of ["/cart", "/checkout", "/pretraga", "/payment/success"]) {
    assert.equal(putanje.has(zabranjena), false, zabranjena);
  }
});

test("stranica sa prekidačem ga ima i u kodu stranice", () => {
  // Ako stranica zove `notFound()` kad je funkcija ugašena, mapa sajta mora da
  // je izostavi — inače prijavljuje adresu koja vraća 404.
  const saPrekidacem = STATICKE_STRANICE.filter((stranica) => stranica.capability);
  assert.ok(saPrekidacem.length >= 3, "očekuju se bar tri uslovne stranice");
  for (const stranica of saPrekidacem) {
    assert.match(stranica.capability as string, /^[a-zA-Z]+$/);
  }
});
