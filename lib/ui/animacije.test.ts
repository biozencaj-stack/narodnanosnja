import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Nijedna animaciona klasa se ne sme koristiti a ne postojati.
 *
 * `Dialog`, `Drawer`, `Accordion` i filter traka su do faze 6 pisali
 * `animate-in`, `slide-in-from-*`, `zoom-in-95` i `animate-accordion-*`. Te
 * klase dolaze iz plugina `tailwindcss-animate`, koji NIJE zavisnost, a
 * `tailwind.config.ts` se u Tailwind-u 4 ne učitava bez `@config` direktive.
 * Dijalog, fioka i harmonika su zato skakali bez ijedne animacije — bez ijedne
 * greške u konzoli i bez ijednog pada u izgradnji.
 *
 * Tiha klasa je gora od odsutne: kod izgleda kao da nešto radi.
 */

const KOREN = new URL("../../", import.meta.url).pathname;

/** Klase iz `tailwindcss-animate`; nijedna se ne može koristiti bez plugina. */
const IZ_PLUGINA = [
  "animate-in",
  "animate-out",
  "fade-in-",
  "fade-out-",
  "zoom-in-",
  "zoom-out-",
  "slide-in-from-",
  "slide-out-to-",
  "animate-accordion-",
];

function fajlovi(putanja: string): string[] {
  const rezultat: string[] = [];
  for (const unos of readdirSync(putanja)) {
    if (unos === "node_modules" || unos.startsWith(".")) continue;
    const puna = join(putanja, unos);
    if (statSync(puna).isDirectory()) {
      rezultat.push(...fajlovi(puna));
      continue;
    }
    if (unos.endsWith(".tsx") || unos.endsWith(".ts")) rezultat.push(puna);
  }
  return rezultat;
}

/** Redovi koda; komentari o samoj zamci se ne broje kao upotreba. */
function redoviKoda(sadrzaj: string): string[] {
  return sadrzaj
    .split("\n")
    .filter((red) => !red.trim().startsWith("//") && !red.trim().startsWith("*"));
}

test("nijedna komponenta ne koristi klase nepostojećeg animate plugina", () => {
  const nadjeno: string[] = [];
  for (const koren of ["components", "app"]) {
    for (const putanja of fajlovi(join(KOREN, koren))) {
      for (const red of redoviKoda(readFileSync(putanja, "utf8"))) {
        for (const klasa of IZ_PLUGINA) {
          if (red.includes(klasa)) nadjeno.push(`${putanja.replace(KOREN, "")}: ${klasa}`);
        }
      }
    }
  }
  assert.deepEqual(nadjeno, [], nadjeno.join("\n"));
});

test("`tailwindcss-animate` i dalje nije zavisnost", () => {
  // Ako se ikad doda, gornja provera prestaje da ima smisla i mora se ukloniti
  // zajedno sa ovom — a ne ostati kao pravilo koje više ništa ne štiti.
  const paket = JSON.parse(readFileSync(join(KOREN, "package.json"), "utf8"));
  const sve = { ...paket.dependencies, ...paket.devDependencies };
  assert.equal("tailwindcss-animate" in sve, false);
});

test("svaka animaciona klasa koju komponente koriste postoji u globals.css", () => {
  const css = readFileSync(join(KOREN, "app", "globals.css"), "utf8");
  for (const klasa of [
    "animacija-preklopa",
    "animacija-dijaloga",
    "animacija-fioke-desno",
    "animacija-fioke-levo",
    "animacija-harmonike",
    "sekcija-ulaz-blago",
    "sekcija-ulaz-odozdo",
    "sekcija-ulaz-sleva",
    "sekcija-ulaz-uvecanje",
    "animate-marquee",
  ]) {
    assert.ok(css.includes(`.${klasa}`), `${klasa} nije definisana`);
  }
});

test("harmonika animira visinu preko Radix promenljive", () => {
  // `height: auto` nije interpolabilan; bez `--radix-accordion-content-height`
  // animacija bi se tiho svela na skok.
  const css = readFileSync(join(KOREN, "app", "globals.css"), "utf8");
  assert.match(css, /--radix-accordion-content-height/);
});

test("mrtav `tailwind.config.ts` je obrisan", () => {
  // Tailwind 4 ga ne učitava bez `@config`, a stajao je pun boja koje izgledaju
  // kao izvor istine. Paleta je u `@theme` bloku u `app/globals.css`.
  let postoji = true;
  try {
    statSync(join(KOREN, "tailwind.config.ts"));
  } catch {
    postoji = false;
  }
  assert.equal(postoji, false);
});
