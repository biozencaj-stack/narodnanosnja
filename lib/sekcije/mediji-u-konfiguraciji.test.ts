import assert from "node:assert/strict";
import test from "node:test";
import { medijiUKonfiguraciji } from "./mediji-u-konfiguraciji";

function medij(putanja: string) {
  return { putanja, alt: { sr: "opis", en: "" }, dekorativna: false };
}

test("nalazi slike iz `medijLista` polja, sa indeksom u putanji polja", () => {
  const nadjeno = medijiUKonfiguraciji("hero", {
    slike: [
      medij("/uploads/sekcije-hero/1-a.webp"),
      medij("/uploads/sekcije-hero/2-b.webp"),
    ],
  });

  assert.deepEqual(nadjeno, [
    { polje: "slike[0]", putanja: "/uploads/sekcije-hero/1-a.webp" },
    { polje: "slike[1]", putanja: "/uploads/sekcije-hero/2-b.webp" },
  ]);
});

test("vrednost koja ne liči na putanju medija se ne broji kao upotreba", () => {
  // Obilazak ide po definiciji polja iz registra, ali sadržaj i dalje mora da
  // prođe isti obrazac koji čuva i CHECK nad `MediaAsset.path`.
  const nadjeno = medijiUKonfiguraciji("hero", {
    slike: [
      medij("../../etc/passwd"),
      medij("https://tudji.example/slika.webp"),
      { putanja: 42 },
      null,
      medij("/uploads/sekcije-hero/3-c.webp"),
    ],
  });

  assert.deepEqual(nadjeno, [
    { polje: "slike[4]", putanja: "/uploads/sekcije-hero/3-c.webp" },
  ]);
});

test("prazna, nepoznata i pogrešno oblikovana konfiguracija ne pucaju", () => {
  assert.deepEqual(medijiUKonfiguraciji("hero", {}), []);
  assert.deepEqual(medijiUKonfiguraciji("hero", null), []);
  assert.deepEqual(medijiUKonfiguraciji("hero", { slike: "tekst" }), []);
  assert.deepEqual(medijiUKonfiguraciji("nepostojeci", { slike: [] }), []);
});

test("tip bez medijskih polja nema nijednu upotrebu", () => {
  assert.deepEqual(
    medijiUKonfiguraciji("naslov", { naslov: { sr: "Zdravo", en: "" } }),
    [],
  );
});

test("putanja polja se ne ponavlja", () => {
  // `MediaAssetUsage` ima jedinstven indeks nad `(sectionId, polje)`; duplikat
  // bi oborio upis cele sekcije.
  const nadjeno = medijiUKonfiguraciji("hero", {
    slike: [medij("/uploads/sekcije-hero/1-a.webp")],
  });
  const kljucevi = nadjeno.map((u) => u.polje);
  assert.equal(new Set(kljucevi).size, kljucevi.length);
});
