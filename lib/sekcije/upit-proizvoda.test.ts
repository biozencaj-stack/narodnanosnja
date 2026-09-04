import assert from "node:assert/strict";
import test from "node:test";
import {
  IZVORI_PROIZVODA,
  MAX_PROIZVODA_U_BLOKU,
  SORTIRANJA_PROIZVODA,
} from "./polja";
import {
  PODRAZUMEVAN_UPIT,
  kljucUpita,
  normalizujUpit,
  planUpita,
  poredjajPoIzboru,
  upitIzKljuca,
} from "./upit-proizvoda";

test("nepoznat ili prazan zapis daje podrazumevan upit, bez izuzetka", () => {
  for (const sirovo of [undefined, null, 42, "izdvojeno", [], { izvor: "nepostojeci" }]) {
    assert.deepEqual(normalizujUpit(sirovo), PODRAZUMEVAN_UPIT);
  }
});

test("broj se svodi na ceo broj u granicama, umesto da obori render", () => {
  assert.equal(normalizujUpit({ broj: 0 }).broj, 1);
  assert.equal(normalizujUpit({ broj: 999 }).broj, MAX_PROIZVODA_U_BLOKU);
  assert.equal(normalizujUpit({ broj: 7.9 }).broj, 7);
  assert.equal(normalizujUpit({ broj: Number.NaN }).broj, PODRAZUMEVAN_UPIT.broj);
  assert.equal(normalizujUpit({ broj: "8" }).broj, PODRAZUMEVAN_UPIT.broj);
});

test("polje koje izabrani izvor ne koristi se pri čitanju briše", () => {
  const upit = normalizujUpit({
    izvor: "izdvojeno",
    kategorija: "salovi",
    brend: "radionica",
    izabrani: ["sal-vuna"],
  });
  assert.equal(upit.kategorija, "");
  assert.equal(upit.brend, "");
  assert.deepEqual(upit.izabrani, []);
});

test("dva bloka koja se razlikuju samo po nekorišćenom polju dele ključ", () => {
  const prvi = normalizujUpit({ izvor: "snizeno", broj: 4, kategorija: "salovi" });
  const drugi = normalizujUpit({ izvor: "snizeno", broj: 4, brend: "radionica" });
  assert.equal(kljucUpita(prvi), kljucUpita(drugi));
});

test("ključ se vraća u isti upit", () => {
  const upit = normalizujUpit({
    izvor: "izabrani",
    izabrani: ["prvi", "drugi"],
    sort: "cenaRastuce",
    broj: 3,
  });
  assert.deepEqual(upitIzKljuca(kljucUpita(upit)), upit);
});

test("pokvaren ključ daje podrazumevan upit umesto izuzetka", () => {
  assert.deepEqual(upitIzKljuca("{ nije json"), PODRAZUMEVAN_UPIT);
  assert.deepEqual(upitIzKljuca('{"izvor":"snizeno"}'), PODRAZUMEVAN_UPIT);
});

test("slug van dozvoljenog oblika se odbacuje, ne prosleđuje u where", () => {
  for (const zao of ["../tajna", "SALOVI", "sal ovi", "-sal", "sal'--", ""]) {
    assert.equal(normalizujUpit({ izvor: "kategorija", kategorija: zao }).kategorija, "");
  }
  assert.equal(
    normalizujUpit({ izvor: "kategorija", kategorija: "salovi-vuna" }).kategorija,
    "salovi-vuna",
  );
});

test("ručni izbor izbacuje duplikate i poštuje granicu", () => {
  const upit = normalizujUpit({
    izvor: "izabrani",
    izabrani: ["a", "b", "a", ...Array.from({ length: 30 }, (_, i) => `p${i}`)],
  });
  assert.equal(new Set(upit.izabrani).size, upit.izabrani.length);
  assert.equal(upit.izabrani.length, MAX_PROIZVODA_U_BLOKU);
  assert.deepEqual(upit.izabrani.slice(0, 2), ["a", "b"]);
});

test("svaki izvor ima plan, i nijedan plan ne izostavlja `active`", () => {
  for (const izvor of IZVORI_PROIZVODA) {
    const upit = normalizujUpit({
      izvor,
      kategorija: "salovi",
      brend: "radionica",
      izabrani: ["prvi"],
    });
    const plan = planUpita(upit);
    assert.ok(plan.length > 0, `${izvor}: prazan plan`);
    for (const korak of plan) {
      assert.equal(korak.where.active, true, `${izvor}: nedostaje active`);
      assert.ok(korak.take >= 1, `${izvor}: take ${korak.take}`);
    }
  }
});

test("izvor bez dopune ne pravi upit — bolje prazna sekcija nego ceo katalog", () => {
  for (const izvor of ["kategorija", "brend", "izabrani"] as const) {
    const plan = planUpita(normalizujUpit({ izvor }));
    assert.deepEqual(plan, [], izvor);
  }
});

test("`izdvojenoISnizeno` ostaje dva koraka, da redosled ostane isti", () => {
  const plan = planUpita(normalizujUpit({ izvor: "izdvojenoISnizeno", broj: 6 }));
  assert.equal(plan.length, 2);
  assert.equal(plan[0].where.featured, true);
  assert.equal(plan[1].where.onSale, true);
  assert.deepEqual(
    plan.map((korak) => korak.take),
    [6, 6],
  );
});

test("ručni izbor uzima tačno onoliko koliko je slugova, bez obzira na `broj`", () => {
  const plan = planUpita(
    normalizujUpit({ izvor: "izabrani", izabrani: ["a", "b", "c"], broj: 1 }),
  );
  assert.equal(plan.length, 1);
  assert.equal(plan[0].take, 3);
});

test("sortiranje po nazivu ne postoji — `Json` kolona bi dala pogrešan red", () => {
  assert.equal((SORTIRANJA_PROIZVODA as readonly string[]).includes("naziv"), false);
  assert.equal((SORTIRANJA_PROIZVODA as readonly string[]).includes("name"), false);
});

test("svako sortiranje daje poredak, i cena se stvarno menja", () => {
  const zaSort = (sort: string) =>
    planUpita(normalizujUpit({ izvor: "izdvojeno", sort }))[0].orderBy;
  assert.deepEqual(zaSort("cenaRastuce"), { price: "asc" });
  assert.deepEqual(zaSort("cenaOpadajuce"), { price: "desc" });
  assert.deepEqual(zaSort("najnovije"), { createdAt: "desc" });
});

test("ručni izbor se prikazuje redom koji je admin postavio", () => {
  const izBaze = [{ slug: "b" }, { slug: "a" }, { slug: "c" }];
  assert.deepEqual(
    poredjajPoIzboru(izBaze, ["a", "b", "c"]).map((s) => s.slug),
    ["a", "b", "c"],
  );
});

test("proizvod koji je u međuvremenu nestao se preskače, ne ostavlja rupu", () => {
  const izBaze = [{ slug: "a" }, { slug: "c" }];
  assert.deepEqual(
    poredjajPoIzboru(izBaze, ["a", "obrisan", "c"]).map((s) => s.slug),
    ["a", "c"],
  );
});
