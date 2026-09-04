import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * Šta middleware sme da preskoči.
 *
 * Otpremljene slike se služe sa diska i nemaju šta da traže u middleware-u:
 * svaka slika na stranici inače nepotrebno pokreće proveru sesije. Ali izuzeci
 * se pišu pažljivo — negativni lookahead nije vezan za granicu segmenta, pa go
 * `uploads` isključi i `/uploadsX`, koja je sasvim druga putanja.
 */

const KOREN = fileURLToPath(new URL("../../", import.meta.url));

function matcherIzProxyja(): RegExp {
  const izvor = readFileSync(`${KOREN}proxy.ts`, "utf8");
  const nadjeno = /matcher:\s*\[\s*(?:\/\*[\s\S]*?\*\/\s*)?"([^"]+)"/.exec(izvor);
  assert.ok(nadjeno, "proxy.ts više ne navodi matcher u očekivanom obliku");
  return new RegExp(`^${nadjeno[1]}$`);
}

test("otpremljene slike zaobilaze middleware", () => {
  const matcher = matcherIzProxyja();
  for (const putanja of [
    "/uploads/products/1-a.webp",
    "/uploads/sekcije-hero/17-x.webp",
  ]) {
    assert.equal(matcher.test(putanja), false, putanja);
  }
});

test("izuzetak ne sme da pojede susedne putanje", () => {
  // Ovo je razlog zbog kog `uploads/` ima kosu crtu.
  const matcher = matcherIzProxyja();
  for (const putanja of ["/uploadsX", "/uploads-arhiva/x", "/uploads"]) {
    assert.equal(matcher.test(putanja), true, putanja);
  }
});

test("stranice i admin API i dalje prolaze kroz middleware", () => {
  const matcher = matcherIzProxyja();
  for (const putanja of [
    "/",
    "/admin",
    "/admin/sekcije",
    "/api/admin/settings",
    "/login",
    "/product/1",
  ]) {
    assert.equal(matcher.test(putanja), true, putanja);
  }
});
