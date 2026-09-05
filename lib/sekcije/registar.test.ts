import assert from "node:assert/strict";
import test from "node:test";
import { OBRAZAC_KLJUCA_STRANICE } from "./polja";
import { OBRAZAC_SIDRA, POLJA_OKVIRA } from "./okvir";
import {
  TIPOVI_SEKCIJA,
  podrazumevanaKonfiguracija,
  poljaTipa,
  OPISI_STRANICA,
  postojiStranica,
  postojiTip,
  STRANICE,
  tipDozvoljenNaStranici,
  tipJeDostupan,
  tipSekcije,
} from "./registar";
import { validirajSekciju } from "./validacija";
import { RASPORED_POCETNE } from "./podrazumevani-raspored";
import { storeCapabilities } from "@/lib/config/capabilities";

test("svaki tip ima jedinstven i ispravno oblikovan ključ", () => {
  const kljucevi = TIPOVI_SEKCIJA.map((tip) => tip.kind);
  assert.equal(new Set(kljucevi).size, kljucevi.length, "ključevi se ponavljaju");

  for (const kind of kljucevi) {
    assert.match(kind, /^[a-z][a-zA-Z0-9]{0,39}$/, kind);
    assert.equal(postojiTip(kind), true, kind);
  }
});

test("podrazumevana konfiguracija svakog tipa prolazi sopstvenu šemu", () => {
  for (const tip of TIPOVI_SEKCIJA) {
    const { greske } = validirajSekciju(tip.kind, tip.podrazumevano);
    assert.deepEqual(greske, {}, `${tip.kind}: ${JSON.stringify(greske)}`);
  }
});

test("podrazumevana konfiguracija je sveža kopija, ne zajednička referenca", () => {
  const prva = podrazumevanaKonfiguracija("stavke");
  const druga = podrazumevanaKonfiguracija("stavke");
  (prva.stavke as unknown[]).push({ naslov: { sr: "x", en: "x" } });

  assert.equal((druga.stavke as unknown[]).length, 0);
  assert.equal(
    (tipSekcije("stavke")?.podrazumevano.stavke as unknown[]).length,
    0,
    "registar je izmenjen spolja",
  );
});

test("nijedan tip ne definiše polje koje se sudara sa okvirom", () => {
  const kljuceviOkvira = new Set(POLJA_OKVIRA.map((polje) => polje.kljuc));

  for (const tip of TIPOVI_SEKCIJA) {
    for (const polje of tip.polja) {
      assert.equal(
        kljuceviOkvira.has(polje.kljuc),
        false,
        `${tip.kind}.${polje.kljuc} preklapa polje okvira`,
      );
    }
  }
});

test("svaki tip ima potpunu podrazumevanu vrednost za svako svoje polje", () => {
  for (const tip of TIPOVI_SEKCIJA) {
    for (const polje of poljaTipa(tip)) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(tip.podrazumevano, polje.kljuc),
        true,
        `${tip.kind} nema podrazumevanu vrednost za ${polje.kljuc}`,
      );
    }
  }
});

test("asinhroni tip ima kostur, sinhroni ga nema", () => {
  for (const tip of TIPOVI_SEKCIJA) {
    if (tip.asinhrona) {
      assert.ok(tip.kostur, `${tip.kind} je asinhron a nema kostur`);
    } else {
      assert.equal(tip.kostur, undefined, `${tip.kind} je sinhron a ima kostur`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Zatečeni raspored početne
 * ------------------------------------------------------------------ */

test("raspored početne koristi samo postojeće tipove i prolazi validaciju", () => {
  assert.ok(RASPORED_POCETNE.length > 0);

  for (const sekcija of RASPORED_POCETNE) {
    assert.equal(postojiTip(sekcija.kind), true, sekcija.kind);
    const { greske } = validirajSekciju(sekcija.kind, sekcija.config);
    assert.deepEqual(
      greske,
      {},
      `${sekcija.id} (${sekcija.kind}): ${JSON.stringify(greske)}`,
    );
  }
});

test("identifikatori sekcija početne su jedinstveni", () => {
  const identifikatori = RASPORED_POCETNE.map((sekcija) => sekcija.id);
  assert.equal(new Set(identifikatori).size, identifikatori.length);
});

test("sidro u rasporedu je bezbedno za id atribut i za URL", () => {
  for (const sekcija of RASPORED_POCETNE) {
    const sidro = sekcija.config.sidro;
    if (typeof sidro === "string" && sidro) {
      assert.match(sidro, OBRAZAC_SIDRA, `${sekcija.id}: ${sidro}`);
    }
  }
});

test("veza unutar stranice pokazuje na sidro koje zaista postoji", () => {
  const sidra = new Set(
    RASPORED_POCETNE.map((sekcija) => sekcija.config.sidro).filter(
      (sidro): sidro is string => typeof sidro === "string" && sidro.length > 0,
    ),
  );

  for (const sekcija of RASPORED_POCETNE) {
    const dugmad = Array.isArray(sekcija.config.dugmad) ? sekcija.config.dugmad : [];
    for (const dugme of dugmad as Record<string, unknown>[]) {
      const veza = dugme.veza as { url?: unknown } | undefined;
      const url = typeof veza?.url === "string" ? veza.url : "";
      if (url.startsWith("#")) {
        assert.equal(
          sidra.has(url.slice(1)),
          true,
          `${sekcija.id}: veza ${url} nema odgovarajuće sidro`,
        );
      }
    }
  }
});

test("najviše jedan blok proizvoda po tipu preko dozvoljenog broja", () => {
  const brojPoTipu = new Map<string, number>();
  for (const sekcija of RASPORED_POCETNE) {
    brojPoTipu.set(sekcija.kind, (brojPoTipu.get(sekcija.kind) ?? 0) + 1);
  }

  for (const [kind, koliko] of brojPoTipu) {
    const max = tipSekcije(kind)?.maxPoStrani;
    if (max !== undefined) {
      assert.ok(koliko <= max, `${kind}: ${koliko} sekcija, dozvoljeno ${max}`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Prekidači prodavnice
 * ------------------------------------------------------------------ */

test("tip bez prekidača je uvek dostupan, i uz prazan spisak prekidača", () => {
  assert.equal(tipJeDostupan("naslov", {}), true);
  assert.equal(tipJeDostupan("proizvodi", {}), true);
});

test("tip sa prekidačem traži da je prekidač upaljen", () => {
  assert.equal(tipJeDostupan("newsletter", { newsletter: true }), true);
  assert.equal(tipJeDostupan("newsletter", { newsletter: false }), false);
  // Odsutan prekidač NIJE isto što i upaljen: podrazumevano je zabrana.
  assert.equal(tipJeDostupan("newsletter", {}), false);
  assert.equal(tipJeDostupan("utisci", { reviews: true }), true);
  assert.equal(tipJeDostupan("utisci", { reviews: false }), false);
});

test("nepoznat tip ne obara proveru dostupnosti", () => {
  assert.equal(tipJeDostupan("nepostojeci", {}), true);
});

test("svaki prekidač u registru postoji i u `storeCapabilities`", () => {
  // Pogrešno ime prekidača bi tiho značilo „uvek isključeno“, jer nepostojeći
  // ključ nikad nije `true`.
  const poznati = new Set(Object.keys(storeCapabilities));
  for (const tip of TIPOVI_SEKCIJA) {
    if (!tip.capability) continue;
    assert.ok(poznati.has(tip.capability), `${tip.kind}: ${tip.capability}`);
  }
});

/* ------------------------------------------------------------------ *
 * Zone stranica
 * ------------------------------------------------------------------ */

test("svaka zona ima opis, i nijedan opis nije bez zone", () => {
  assert.deepEqual(
    OPISI_STRANICA.map((stranica) => stranica.kljuc),
    [...STRANICE],
  );
});

test("ključ zone prolazi isti obrazac koji stoji kao CHECK u bazi", () => {
  for (const kljuc of STRANICE) {
    assert.match(kljuc, OBRAZAC_KLJUCA_STRANICE, kljuc);
    // Dvotačka je namerno zabranjena: `stranica:<slug>` je i dalje samo
    // zamisao, a jednom dozvoljena vrednost u bazi se teško povlači nazad.
    assert.equal(kljuc.includes(":"), false, kljuc);
  }
});

test("nepoznata zona ne postoji i ne prima nijedan tip", () => {
  assert.equal(postojiStranica("nepostojeca"), false);
  assert.equal(tipDozvoljenNaStranici("naslov", "nepostojeca"), false);
  // Sekcija upisana na ključ koji nijedna stranica ne renderuje postojala bi u
  // bazi a nikad se ne bi videla — i to bez ijedne poruke.
  assert.equal(tipDozvoljenNaStranici("naslov", "stranica:o-nama"), false);
});

test("zona iznad podnožja ne prima tipove koji čitaju katalog", () => {
  // Ta zona stoji na SVAKOJ stranici prodavnice, pa bi blok proizvoda tamo
  // značio upit ka bazi na svakom pogotku.
  for (const kind of ["proizvodi", "taksonomija", "clanci", "utisci", "odbrojavanje"]) {
    assert.equal(tipDozvoljenNaStranici(kind, "prefooter"), false, kind);
    assert.equal(tipDozvoljenNaStranici(kind, "home"), true, kind);
  }
});

test("jeftini tipovi smeju u svaku zonu, uključujući onu iznad podnožja", () => {
  for (const kind of ["naslov", "hero", "tekst", "tabela", "cenovnik", "traka"]) {
    for (const zona of STRANICE) {
      assert.equal(tipDozvoljenNaStranici(kind, zona), true, `${kind} / ${zona}`);
    }
  }
});

test("svaki tip sme bar u jednu zonu", () => {
  for (const tip of TIPOVI_SEKCIJA) {
    const zone = STRANICE.filter((zona) => tipDozvoljenNaStranici(tip.kind, zona));
    assert.ok(zone.length > 0, `${tip.kind} nema nijednu zonu`);
  }
});
