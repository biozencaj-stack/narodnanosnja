import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * CSP se ne širi usput.
 *
 * Faza 6 donosi video, ali **bez ijedne izmene `frame-src`**: `www.youtube.com`
 * je u politici stajao i ranije. Vimeo i `youtube-nocookie.com` bi je tražili i
 * to je zasebna bezbednosna odluka vlasnika, ne nusproizvod jednog tipa sekcije.
 *
 * Provera čita `next.config.ts` kao tekst umesto da ga uvozi: konfiguracija
 * povlači Next runtime, a ovde je pitanje šta u fajlu PIŠE.
 */
const IZVOR = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");

function direktiva(ime: string): string {
  const pogodak = IZVOR.match(new RegExp(`"${ime} ([^"]*)"`));
  assert.ok(pogodak, `direktiva ${ime} ne postoji u CSP-u`);
  return pogodak[1];
}

test("`frame-src` dozvoljava tačno očekivane izvore", () => {
  assert.deepEqual(direktiva("frame-src").split(" ").sort(), [
    "'self'",
    "https://recaptcha.google.com",
    "https://www.google.com",
    "https://www.youtube.com",
  ]);
});

test("Vimeo i nocookie domen nisu ušli u politiku", () => {
  for (const domen of ["vimeo", "youtube-nocookie", "player.vimeo.com"]) {
    assert.equal(IZVOR.includes(domen), false, domen);
  }
});

test("`object-src` i `frame-ancestors` ostaju zatvoreni", () => {
  assert.equal(direktiva("object-src"), "'none'");
  assert.equal(direktiva("frame-ancestors"), "'none'");
});

test("YouTube poster je dozvoljen kao slika, i to samo pod `/vi/`", () => {
  // Slika nije okvir: `remotePatterns` je `next/image` optimizacija, ne CSP.
  assert.match(IZVOR, /hostname: 'i\.ytimg\.com'/);
  assert.match(IZVOR, /pathname: '\/vi\/\*\*'/);
});

test("video se ugrađuje samo sa domena koji CSP dozvoljava", () => {
  const video = readFileSync(
    new URL("../../components/sekcije/VideoOkidac.tsx", import.meta.url),
    "utf8",
  );
  const okviri = [...video.matchAll(/src=\{`(https:\/\/[^/`]+)/g)].map((m) => m[1]);
  for (const okvir of okviri) {
    assert.ok(
      direktiva("frame-src").includes(okvir),
      `${okvir} nije u frame-src`,
    );
  }
});
