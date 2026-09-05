import assert from "node:assert/strict";
import test from "node:test";
import { podrazumevanaKonfiguracija } from "./registar";
import {
  MAX_BAJTOVA_KONFIGURACIJE,
  normalizujSekciju,
  proveriKontrastSekcije,
  sanitizujSekciju,
  validirajSekciju,
} from "./validacija";

function sa(kind: string, izmene: Record<string, unknown>) {
  return { ...podrazumevanaKonfiguracija(kind), ...izmene };
}

/* ------------------------------------------------------------------ *
 * Granice tipa i oblika
 * ------------------------------------------------------------------ */

test("nepoznat tip sekcije se odbija", () => {
  const { greske } = validirajSekciju("nepostojeci", {});
  assert.ok(greske.kind);
});

test("konfiguracija koja nije objekat se odbija", () => {
  for (const vrednost of [null, [], "tekst", 7, undefined]) {
    const { greske } = validirajSekciju("naslov", vrednost);
    assert.ok(greske.config, String(vrednost));
  }
});

test("nepoznat ključ se tiho odbacuje", () => {
  const { vrednosti, greske } = validirajSekciju(
    "naslov",
    sa("naslov", { izmisljenoPolje: "vrednost", onClick: "alert(1)" }),
  );

  assert.deepEqual(greske, {});
  assert.equal("izmisljenoPolje" in vrednosti, false);
  assert.equal("onClick" in vrednosti, false);
});

test("obavezno polje u stavci mora imati srpski tekst", () => {
  const { greske } = validirajSekciju(
    "stavke",
    sa("stavke", { stavke: [{ naslov: { sr: "", en: "" }, tekst: { sr: "x", en: "x" } }] }),
  );

  assert.ok(greske["stavke[0].naslov.sr"]);
});

test("prekoračena dužina teksta se prijavljuje po jeziku", () => {
  const predugacko = "a".repeat(200);
  const { greske } = validirajSekciju("naslov", sa("naslov", { naslov: { sr: predugacko, en: "ok" } }));

  assert.ok(greske["naslov.sr"]);
  assert.equal(greske["naslov.en"], undefined);
});

test("lista preko dozvoljenog broja stavki se odbija i skraćuje", () => {
  const stavka = { naslov: { sr: "Naslov", en: "Naslov" } };
  const { vrednosti, greske } = validirajSekciju(
    "stavke",
    sa("stavke", { stavke: Array.from({ length: 12 }, () => stavka) }),
  );

  assert.ok(greske.stavke);
  assert.equal((vrednosti.stavke as unknown[]).length, 8);
});

test("prevelika konfiguracija se odbija", () => {
  const ogroman = "a".repeat(MAX_BAJTOVA_KONFIGURACIJE);
  const { greske } = validirajSekciju(
    "tekst",
    sa("tekst", { sadrzaj: { sr: ogroman, en: ogroman } }),
  );

  assert.ok(greske.config || greske["sadrzaj.sr"]);
});

/* ------------------------------------------------------------------ *
 * Zatvorene liste vrednosti
 * ------------------------------------------------------------------ */

test("boja mora biti token iz palete, nikad slobodan HEX", () => {
  const { greske } = validirajSekciju(
    "naslov",
    sa("naslov", { pozadina: "#ff0000", saraBoja: "rgb(1,2,3)" }),
  );

  assert.ok(greske.pozadina);
  assert.ok(greske.saraBoja);
});

test("izbor van ponuđenih vrednosti se odbija", () => {
  const { greske } = validirajSekciju("stavke", sa("stavke", { prikaz: "karusel" }));
  assert.ok(greske.prikaz);
});

test("sidro prima samo bezbedan oblik", () => {
  for (const sidro of ["Kako Nastaje", "kako nastaje", "1korak", "kako/nastaje", "#kako"]) {
    const { greske } = validirajSekciju("naslov", sa("naslov", { sidro }));
    assert.ok(greske.sidro, sidro);
  }

  const { greske } = validirajSekciju("naslov", sa("naslov", { sidro: "kako-nastaje" }));
  assert.equal(greske.sidro, undefined);
});

test("istaknuta reč mora postojati u naslovu", () => {
  const losa = validirajSekciju(
    "naslov",
    sa("naslov", { naslov: { sr: "Svaki komad", en: "" }, istaknutaRec: "razboj" }),
  );
  assert.ok(losa.greske.istaknutaRec);

  const dobra = validirajSekciju(
    "naslov",
    sa("naslov", { naslov: { sr: "Svaki komad", en: "" }, istaknutaRec: "komad" }),
  );
  assert.equal(dobra.greske.istaknutaRec, undefined);
});

/* ------------------------------------------------------------------ *
 * Veze
 * ------------------------------------------------------------------ */

test("nebezbedna veza u dugmetu se odbija", () => {
  const nebezbedne = [
    "javascript:alert(1)",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "/a/../../b",
    "data:text/html,<script>alert(1)</script>",
  ];

  for (const url of nebezbedne) {
    const { greske } = validirajSekciju(
      "hero",
      sa("hero", {
        dugmad: [{ natpis: { sr: "Klik", en: "Klik" }, veza: { url }, stil: "puno" }],
      }),
    );
    assert.ok(greske["dugmad[0].veza.url"], url);
  }
});

test("bezbedna veza prolazi u sva tri oblika", () => {
  for (const url of ["/catalog", "#kako-nastaje", "https://primer.rs/"]) {
    const { greske } = validirajSekciju(
      "hero",
      sa("hero", {
        dugmad: [{ natpis: { sr: "Klik", en: "Klik" }, veza: { url }, stil: "puno" }],
        sidro: "kako-nastaje",
      }),
    );
    assert.deepEqual(greske, {}, url);
  }
});

/* ------------------------------------------------------------------ *
 * Mediji
 * ------------------------------------------------------------------ */

test("slika mora doći iz medijateke i imati opis", () => {
  const vanMedijateke = validirajSekciju(
    "hero",
    sa("hero", {
      slike: [{ putanja: "https://evil.example/a.png", alt: { sr: "a", en: "a" } }],
    }),
  );
  assert.ok(vanMedijateke.greske["slike[0].putanja"]);

  const izlazakIzFascikle = validirajSekciju(
    "hero",
    sa("hero", { slike: [{ putanja: "/uploads/sekcije/../../etc/passwd", alt: { sr: "a", en: "a" } }] }),
  );
  assert.ok(izlazakIzFascikle.greske["slike[0].putanja"]);

  const bezOpisa = validirajSekciju(
    "hero",
    sa("hero", { slike: [{ putanja: "/uploads/sekcije/1-a.webp", alt: { sr: "", en: "" } }] }),
  );
  assert.ok(bezOpisa.greske["slike[0].alt.sr"]);

  const ukrasna = validirajSekciju(
    "hero",
    sa("hero", {
      slike: [
        { putanja: "/uploads/sekcije/1-a.webp", alt: { sr: "", en: "" }, dekorativna: true },
      ],
    }),
  );
  assert.deepEqual(ukrasna.greske, {});
});

/* ------------------------------------------------------------------ *
 * Upit proizvoda
 * ------------------------------------------------------------------ */

test("blok proizvoda prihvata samo poznat izvor i razuman broj", () => {
  const losIzvor = validirajSekciju(
    "proizvodi",
    sa("proizvodi", { upit: { izvor: "svi", broj: 8 } }),
  );
  assert.ok(losIzvor.greske["upit.izvor"]);

  for (const broj of [0, 25, 2.5, -3]) {
    const { greske } = validirajSekciju(
      "proizvodi",
      sa("proizvodi", { upit: { izvor: "snizeno", broj } }),
    );
    assert.ok(greske["upit.broj"], String(broj));
  }
});

test("sekcija nikad ne pamti cenu", () => {
  const { vrednosti } = validirajSekciju(
    "proizvodi",
    sa("proizvodi", { upit: { izvor: "snizeno", broj: 4, cena: 1990 } }),
  );

  assert.deepEqual(vrednosti.upit, {
    izvor: "snizeno",
    broj: 4,
    sort: "najnovije",
    kategorija: "",
    brend: "",
    izabrani: [],
  });
  assert.equal("cena" in (vrednosti.upit as Record<string, unknown>), false);
});

test("izvor koji traži dopunu se bez nje odbija", () => {
  for (const [izvor, kljuc] of [
    ["kategorija", "upit.kategorija"],
    ["brend", "upit.brend"],
    ["izabrani", "upit.izabrani"],
  ] as const) {
    const { greske } = validirajSekciju("proizvodi", sa("proizvodi", { upit: { izvor, broj: 4 } }));
    // Bez ove provere bi blok pao na prazan filter i prikazao ceo katalog
    // umesto izabranog dela — tiho, i tek na produkciji vidljivo.
    assert.ok(greske[kljuc], `${izvor}: nedostaje greška ${kljuc}`);
  }
});

test("dopunjen izvor prolazi", () => {
  const slucajevi = [
    { izvor: "kategorija", kategorija: "salovi" },
    { izvor: "brend", brend: "radionica" },
    { izvor: "izabrani", izabrani: ["sal-vuna", "tkanica"] },
  ];
  for (const upit of slucajevi) {
    const { greske } = validirajSekciju(
      "proizvodi",
      sa("proizvodi", { upit: { ...upit, broj: 4 } }),
    );
    assert.deepEqual(greske, {}, JSON.stringify(upit));
  }
});

test("slug van dozvoljenog oblika se odbija, ne završava u where klauzuli", () => {
  for (const zao of ["../tajna", "SALOVI", "sal ovi", "sal'--"]) {
    const { greske, vrednosti } = validirajSekciju(
      "proizvodi",
      sa("proizvodi", { upit: { izvor: "kategorija", broj: 4, kategorija: zao } }),
    );
    assert.ok(greske["upit.kategorija"], zao);
    assert.equal((vrednosti.upit as Record<string, unknown>).kategorija, "");
  }
});

test("nepoznato sortiranje se odbija, umesto da tiho promeni redosled", () => {
  const { greske } = validirajSekciju(
    "proizvodi",
    sa("proizvodi", { upit: { izvor: "snizeno", broj: 4, sort: "naziv" } }),
  );
  assert.ok(greske["upit.sort"]);
});

test("tabovi se validiraju kao i glavni izvor", () => {
  const { greske } = validirajSekciju(
    "proizvodi",
    sa("proizvodi", {
      tabovi: [
        { naslov: { sr: "Novo", en: "New" }, upit: { izvor: "novo", broj: 4 } },
        { naslov: { sr: "Sniženo", en: "Sale" }, upit: { izvor: "brend", broj: 4 } },
      ],
    }),
  );
  assert.ok(greske["tabovi[1].upit.brend"], JSON.stringify(greske));
});

/* ------------------------------------------------------------------ *
 * Kontrast
 * ------------------------------------------------------------------ */

test("svaka ponuđena pozadina ima čitljiv tekst", () => {
  for (const pozadina of ["podloga", "podlogaAlt", "povrsina", "tamna"]) {
    assert.equal(proveriKontrastSekcije(pozadina).ok, true, pozadina);
  }
});

test("nepoznata pozadina pada na proveri kontrasta", () => {
  assert.equal(proveriKontrastSekcije("neonska").ok, false);
});

/* ------------------------------------------------------------------ *
 * Sanitizacija pri upisu
 * ------------------------------------------------------------------ */

test("skripta u bogatom tekstu nestaje pri upisu", () => {
  const ocisceno = sanitizujSekciju(
    "tekst",
    sa("tekst", {
      sadrzaj: {
        sr: '<p>Tekst</p><script>alert(1)</script><img src=x onerror=alert(1)>',
        en: '<a href="javascript:alert(1)">klik</a>',
      },
    }),
  );

  const sadrzaj = ocisceno.sadrzaj as { sr: string; en: string };
  assert.equal(sadrzaj.sr.includes("<script"), false);
  assert.equal(sadrzaj.sr.includes("onerror"), false);
  assert.ok(sadrzaj.sr.includes("<p>Tekst</p>"));
  assert.equal(sadrzaj.en.includes("javascript:"), false);
});

/* ------------------------------------------------------------------ *
 * Normalizacija pri čitanju
 * ------------------------------------------------------------------ */

test("normalizacija popunjava polje dodato posle upisa reda", () => {
  const stariRed = { naslov: { sr: "Stari naslov", en: "" } };
  const vrednosti = normalizujSekciju("naslov", stariRed);

  assert.equal((vrednosti.naslov as { sr: string }).sr, "Stari naslov");
  assert.equal(vrednosti.pozadina, "podloga");
  assert.equal(vrednosti.razmak, "srednji");
  assert.equal(vrednosti.razdelnikGore, "bez");
});

test("normalizacija pretvara običan tekst u lokalizovanu vrednost", () => {
  const vrednosti = normalizujSekciju("naslov", { naslov: "Samo srpski" });
  assert.deepEqual(vrednosti.naslov, { sr: "Samo srpski", en: "Samo srpski" });
});

test("normalizacija pokvarenu vrednost menja podrazumevanom, bez izuzetka", () => {
  const vrednosti = normalizujSekciju("stavke", {
    prikaz: "nepostojeci",
    kolone: 4,
    stavke: "nije lista",
  });

  assert.equal(vrednosti.prikaz, "kartice");
  assert.equal(vrednosti.kolone, "4");
  assert.deepEqual(vrednosti.stavke, []);
});

test("normalizacija nepoznatog tipa vraća prazan objekat umesto izuzetka", () => {
  assert.deepEqual(normalizujSekciju("nepostojeci", { a: 1 }), {});
});

/* ------------------------------------------------------------------ *
 * Faza 5 — jeftini tipovi
 * ------------------------------------------------------------------ */

test("stavke sa izvorom iz pitanja i odgovora bez kategorije se odbijaju", () => {
  const { greske } = validirajSekciju(
    "stavke",
    sa("stavke", { prikaz: "harmonika", izvor: "faq", faqKategorija: "" }),
  );
  // Bez filtera bi svako pitanje napisano za chat widžet odmah osvanulo i na
  // stranici, a admin ne bi imao način da to razdvoji.
  assert.ok(greske.faqKategorija, JSON.stringify(greske));
});

test("izvor iz pitanja i odgovora radi samo uz prikaz harmonika", () => {
  const { greske } = validirajSekciju(
    "stavke",
    sa("stavke", { prikaz: "kartice", izvor: "faq", faqKategorija: "dostava" }),
  );
  assert.ok(greske.izvor, JSON.stringify(greske));
});

test("harmonika sa kategorijom prolazi", () => {
  const { greske } = validirajSekciju(
    "stavke",
    sa("stavke", { prikaz: "harmonika", izvor: "faq", faqKategorija: "dostava" }),
  );
  assert.deepEqual(greske, {});
});

test("odbrojavanje do unetog trenutka bez trenutka se odbija", () => {
  const { greske } = validirajSekciju(
    "odbrojavanje",
    sa("odbrojavanje", { izvor: "datum", datum: "" }),
  );
  assert.ok(greske.datum, JSON.stringify(greske));
});

test("datum van oblika ili nepostojeći dan se odbija", () => {
  for (const datum of ["31.12.2026.", "2026-13-01T10:00", "2026-02-31T10:00", "juče"]) {
    const { greske } = validirajSekciju(
      "odbrojavanje",
      sa("odbrojavanje", { izvor: "datum", datum }),
    );
    assert.ok(greske.datum, datum);
  }
});

test("ispravan datum prolazi", () => {
  const { greske, vrednosti } = validirajSekciju(
    "odbrojavanje",
    sa("odbrojavanje", { izvor: "datum", datum: "2026-12-31T23:59" }),
  );
  assert.deepEqual(greske, {});
  assert.equal(vrednosti.datum, "2026-12-31T23:59");
});

test("tabela sa redovima ali bez zaglavlja se odbija", () => {
  const { greske } = validirajSekciju(
    "tabela",
    sa("tabela", {
      zaglavlje: [],
      redovi: [{ c1: { sr: "S", en: "S" } }],
    }),
  );
  // Broj kolona dolazi iz zaglavlja; bez njega se ne zna šta se renderuje.
  assert.ok(greske.zaglavlje, JSON.stringify(greske));
});

test("cenovnik čuva osobine kao višelinijski tekst, bez ugnežđene liste", () => {
  const { greske, vrednosti } = validirajSekciju(
    "cenovnik",
    sa("cenovnik", {
      paketi: [
        {
          naziv: { sr: "Osnovni", en: "Basic" },
          cena: "3.500",
          valuta: "RSD",
          osobine: { sr: "Prva\nDruga", en: "First\nSecond" },
          istaknuto: true,
        },
      ],
    }),
  );
  assert.deepEqual(greske, {});
  const paketi = vrednosti.paketi as Record<string, unknown>[];
  assert.equal((paketi[0].osobine as { sr: string }).sr, "Prva\nDruga");
});
