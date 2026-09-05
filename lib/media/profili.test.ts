import assert from "node:assert/strict";
import test from "node:test";
import {
  DOZVOLJENI_FOLDERI,
  MAX_KVALITETA,
  MIN_KVALITETA,
  jeDozvoljenMime,
  profilZaFolder,
} from "./profili";

test("zatečene fascikle zadržavaju stare granice", () => {
  // Podizanje bi bez potrebe povećalo postojeće slike i promenilo izgled
  // stranica koje su podešene prema ovim dimenzijama.
  for (const folder of ["products", "articles", "categories", "brands"]) {
    const profil = profilZaFolder(folder);
    assert.ok(profil, folder);
    assert.equal(profil.maxBajtova, 1_048_576, folder);
    assert.equal(profil.maxSirina, 800, folder);
    assert.equal(profil.maxVisina, 800, folder);
  }
});

test("hero prima veći fajl i veće dimenzije od kartice", () => {
  const hero = profilZaFolder("sekcije-hero");
  const kartica = profilZaFolder("sekcije-kartica");
  assert.ok(hero && kartica);
  assert.ok(hero.maxBajtova > kartica.maxBajtova);
  assert.ok(hero.maxSirina > kartica.maxSirina);
});

test("kvalitet svakog profila ostaje u dozvoljenom opsegu", () => {
  // Ispod 70 se na tkaninama i vezu vide artefakti kompresije; iznad 75 fajl
  // raste bez vidljive razlike. Ovo je pravilo, ne preporuka.
  for (const folder of DOZVOLJENI_FOLDERI) {
    const profil = profilZaFolder(folder);
    assert.ok(profil, folder);
    assert.ok(profil.kvalitet >= MIN_KVALITETA, `${folder} ispod donje granice`);
    assert.ok(profil.kvalitet <= MAX_KVALITETA, `${folder} iznad gornje granice`);
  }
});

test("nepoznata fascikla nema profil", () => {
  for (const folder of ["", "uploads", "../products", "PRODUCTS", null, 7]) {
    assert.equal(profilZaFolder(folder), null, String(folder));
  }
});

test("MIME spisak odbija ono što nije slika", () => {
  assert.equal(jeDozvoljenMime("image/webp"), true);
  for (const tip of ["text/html", "image/svg+xml", "application/pdf", "", null]) {
    assert.equal(jeDozvoljenMime(tip), false, String(tip));
  }
});
