import assert from "node:assert/strict";
import test from "node:test";
import { oznakaStranice, oznakeZaInvalidaciju } from "./invalidacija";

test("oznaka je po stranici, pa objava jedne ne ruši keš ostalih", () => {
  assert.equal(oznakaStranice("home"), "sekcije:home");
  assert.notEqual(oznakaStranice("home"), oznakaStranice("o-nama"));
});

test("neispravan ključ stranice ne može da napravi oznaku", () => {
  // Isti obrazac stoji kao CHECK nad `PageSection.pageKey`. Dvotačka je
  // zabranjena dok odluka o `stranica:<slug>` ne bude doneta.
  for (const los of ["", "Home", "stranica:o-nama", "-home", "a".repeat(65)]) {
    assert.throws(() => oznakaStranice(los), RangeError, los);
  }
});

test("čuvanje nacrta NIŠTA ne poništava", () => {
  // Ovo je cela poenta nacrta. Kad bi čuvanje nacrta čistilo keš, svaki potez u
  // admin obrascu rušio bi keš početne za sve posetioce — a javna stranica bi
  // se pregradila iz istih objavljenih podataka, dakle bez ikakve koristi.
  assert.deepEqual(oznakeZaInvalidaciju("nacrt", "home"), []);
});

test("objava, brisanje, redosled i vidljivost ruše keš svoje stranice", () => {
  for (const razlog of ["objava", "brisanje", "redosled", "vidljivost"] as const) {
    assert.deepEqual(
      oznakeZaInvalidaciju(razlog, "home"),
      ["sekcije:home"],
      razlog,
    );
  }
});
