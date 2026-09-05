import assert from "node:assert/strict";
import test from "node:test";
import { proveriUlazUploada } from "./upload-ulaz";

const SLIKA = { type: "image/jpeg", size: 500_000 };

test("ispravan ulaz prolazi i vraća profil", () => {
  const ishod = proveriUlazUploada(SLIKA, "products");
  assert.equal(ishod.ok, true);
  if (ishod.ok) assert.equal(ishod.profil.folder, "products");
});

test("granica se razlikuje po fascikli", () => {
  const trimegabajta = { type: "image/jpeg", size: 3_000_000 };

  // Isti fajl: u hero fascikli prolazi, u fascikli proizvoda pada.
  assert.equal(proveriUlazUploada(trimegabajta, "sekcije-hero").ok, true);

  const pao = proveriUlazUploada(trimegabajta, "products");
  assert.equal(pao.ok, false);
  if (!pao.ok) {
    assert.equal(pao.razlog, "PREVELIK");
    // 413, ne 400: problem je veličina, ne oblik zahteva.
    assert.equal(pao.status, 413);
    assert.match(pao.poruka, /products/);
  }
});

test("prazan fajl i nepoznata veličina se odbijaju", () => {
  for (const size of [0, -1, Number.NaN, "500", undefined]) {
    const ishod = proveriUlazUploada({ type: "image/png", size }, "products");
    assert.equal(ishod.ok, false, String(size));
  }
});

test("nepoznata fascikla pada pre svake druge provere", () => {
  // Redosled je bitan: fascikla određuje granicu, pa se proverava prva.
  const ishod = proveriUlazUploada(null, "../etc");
  assert.equal(ishod.ok, false);
  if (!ishod.ok) assert.equal(ishod.razlog, "NEPOZNAT_FOLDER");
});

test("nedostatak fajla i pogrešan tip imaju svoje razloge", () => {
  const bezFajla = proveriUlazUploada(null, "products");
  assert.equal(bezFajla.ok, false);
  if (!bezFajla.ok) assert.equal(bezFajla.razlog, "NEMA_FAJLA");

  const losTip = proveriUlazUploada(
    { type: "image/svg+xml", size: 100 },
    "products",
  );
  assert.equal(losTip.ok, false);
  if (!losTip.ok) assert.equal(losTip.razlog, "NEDOZVOLJEN_TIP");
});
