import assert from "node:assert/strict";
import test from "node:test";
import { buildProductOrderBy, buildProductWhere } from "./products-filter";

/** Uslovi tipa „bilo koje od“ koje sklapa builder. */
function grupe(where: ReturnType<typeof buildProductWhere>) {
  return Array.isArray(where.AND) ? where.AND : [];
}

test("bez ijedne opcije traži samo aktivne proizvode", () => {
  const where = buildProductWhere();
  assert.equal(where.active, true);
  assert.equal(where.AND, undefined);
});

test("kategorija i pretraga se PRESECAJU, ne potiru", () => {
  const where = buildProductWhere({ categorySlug: "salovi", search: "vuna" });
  const uslovi = grupe(where);

  assert.equal(uslovi.length, 2, "očekuju se dva zasebna uslova");

  const kategorija = JSON.stringify(uslovi[0]);
  const pretraga = JSON.stringify(uslovi[1]);
  assert.ok(kategorija.includes("salovi"), "filter po kategoriji je izgubljen");
  assert.ok(pretraga.includes("vuna"), "pojam pretrage je izgubljen");

  // Regresija: ranije je pretraga prepisivala `where.OR`, pa je kategorija
  // nestajala bez ijedne poruke.
  assert.equal(where.OR, undefined, "uslovi ne smeju ići direktno u where.OR");
});

test("sama kategorija daje isti uslov kao i ranije", () => {
  const uslovi = grupe(buildProductWhere({ categorySlug: "salovi" }));

  assert.equal(uslovi.length, 1);
  assert.deepEqual(uslovi[0], {
    OR: [
      { category: { slug: "salovi" } },
      { categories: { some: { category: { slug: "salovi" } } } },
    ],
  });
});

test("sama pretraga pokriva naziv, opis i šifru", () => {
  const uslovi = grupe(buildProductWhere({ search: "tkanica" }));

  assert.equal(uslovi.length, 1);
  const uslov = uslovi[0] as { OR: unknown[] };
  assert.equal(uslov.OR.length, 5);
  assert.deepEqual(uslov.OR[4], {
    sku: { contains: "tkanica", mode: "insensitive" },
  });
});

test("tip proizvoda potiskuje kategoriju, kako je i ranije bilo", () => {
  const uslovi = grupe(
    buildProductWhere({ categorySlug: "salovi", types: ["Torbe"] }),
  );

  assert.equal(uslovi.length, 1);
  assert.equal(JSON.stringify(uslovi[0]).includes("salovi"), false);
  assert.equal(JSON.stringify(uslovi[0]).includes("torbe"), true);
});

test("boje, tip i pretraga stoje jedno pored drugog", () => {
  const uslovi = grupe(
    buildProductWhere({ search: "vuna", colors: ["Crvena"], types: ["Šalovi"] }),
  );

  assert.equal(uslovi.length, 3);
});

test("pol se prevodi u vrednost koja stvarno stoji u bazi", () => {
  assert.equal(buildProductWhere({ gender: "muske" }).gender, "muski");
  assert.equal(buildProductWhere({ gender: "zenske" }).gender, "zenski");
  assert.equal(buildProductWhere({ gender: "unisex" }).gender, "unisex");
});

test("obe granice cene stoje u istom uslovu", () => {
  const where = buildProductWhere({ minPrice: 500, maxPrice: 2000 });
  assert.deepEqual(where.price, { gte: 500, lte: 2000 });
});

test("maxPriceOnly je zamena za maxPrice, ali ga ne potiskuje", () => {
  assert.deepEqual(buildProductWhere({ maxPriceOnly: 1500 }).price, { lte: 1500 });
  assert.deepEqual(
    buildProductWhere({ maxPrice: 900, maxPriceOnly: 1500 }).price,
    { lte: 900 },
  );
});

test("veličina traži samo ono što je zaista na stanju", () => {
  const where = buildProductWhere({ sizes: ["Univerzalna"] });
  assert.deepEqual(where.sizes, {
    some: { size: { in: ["Univerzalna"] }, stock: { gt: 0 }, active: true },
  });
});

test("prazne liste ne prave suvišan uslov", () => {
  const where = buildProductWhere({ colors: [], types: [], sizes: [], brandIds: [] });
  assert.equal(where.AND, undefined);
  assert.equal(where.sizes, undefined);
  assert.equal(where.brandId, undefined);
});

test("logičke zastavice se postavljaju samo kad su tačne", () => {
  assert.equal(buildProductWhere({ onSale: false }).onSale, undefined);
  assert.equal(buildProductWhere({ onSale: true }).onSale, true);
  assert.equal(buildProductWhere({ novo: true }).novo, true);
  assert.equal(buildProductWhere({ featured: true }).featured, true);
});

test("redosled prikaza pokriva sve ponuđene vrednosti", () => {
  assert.deepEqual(buildProductOrderBy("price_asc"), { price: "asc" });
  assert.deepEqual(buildProductOrderBy("price_desc"), { price: "desc" });
  assert.deepEqual(buildProductOrderBy("name"), { name: "asc" });
  assert.deepEqual(buildProductOrderBy("newest"), { createdAt: "desc" });
  assert.deepEqual(buildProductOrderBy(), { createdAt: "desc" });
});
