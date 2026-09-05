import assert from "node:assert/strict";
import test from "node:test";
import { sanitizujZaPrikaz, tekstIzHtmla } from "./prikaz";

/**
 * Negativan XSS test na RENDER granici.
 *
 * Napad se ovde upisuje MIMO validatora — tačno kao što bi ušao kroz seed
 * skriptu, ručni SQL ili restore starijeg dampa. Ako ove provere padnu, znači
 * da se druga granica sanitizacije negde izgubila i da bi takav red otišao
 * pravo u `dangerouslySetInnerHTML`.
 */

const NAPADI = [
  '<script>alert(1)</script>',
  '<img src=x onerror="alert(1)">',
  '<a href="javascript:alert(1)">klik</a>',
  '<iframe src="https://evil.example"></iframe>',
  '<svg onload="alert(1)"></svg>',
  '<p onclick="alert(1)">tekst</p>',
  '<style>body{display:none}</style>',
  '<object data="data:text/html,<script>alert(1)</script>"></object>',
  '<form action="https://evil.example"><input name="a"></form>',
  '<p style="position:fixed;inset:0">preko cele strane</p>',
];

test("napad upisan mimo validatora ne izlazi na render granici", () => {
  for (const napad of NAPADI) {
    const izlaz = sanitizujZaPrikaz({ sr: napad, en: napad }, "sr");

    assert.equal(/<script/i.test(izlaz), false, napad);
    assert.equal(/<iframe/i.test(izlaz), false, napad);
    assert.equal(/<svg/i.test(izlaz), false, napad);
    assert.equal(/<object/i.test(izlaz), false, napad);
    assert.equal(/<form/i.test(izlaz), false, napad);
    assert.equal(/<style/i.test(izlaz), false, napad);
    assert.equal(/on[a-z]+\s*=/i.test(izlaz), false, napad);
    assert.equal(/javascript:/i.test(izlaz), false, napad);
    assert.equal(/style\s*=/i.test(izlaz), false, napad);
  }
});

test("dozvoljeno oblikovanje preživljava", () => {
  const izlaz = sanitizujZaPrikaz(
    { sr: "<p>Tekst sa <strong>istaknutim</strong> delom</p><ul><li>stavka</li></ul>", en: "" },
    "sr",
  );

  assert.ok(izlaz.includes("<strong>istaknutim</strong>"));
  assert.ok(izlaz.includes("<li>stavka</li>"));
});

test("veza u novom prozoru dobija rel koji sprečava otimanje kartice", () => {
  const izlaz = sanitizujZaPrikaz(
    { sr: '<a href="https://primer.rs" target="_blank">primer</a>', en: "" },
    "sr",
  );

  assert.ok(izlaz.includes('rel="noopener noreferrer"'));
});

test("prazan i neispravan sadržaj daju prazan string, ne izuzetak", () => {
  for (const vrednost of [null, undefined, "", {}, [], 42, { sr: "", en: "" }]) {
    assert.equal(sanitizujZaPrikaz(vrednost, "sr"), "", JSON.stringify(vrednost));
  }
});

test("engleski pada na srpski kad prevoda nema", () => {
  const izlaz = sanitizujZaPrikaz({ sr: "<p>Srpski</p>", en: "" }, "en");
  assert.ok(izlaz.includes("Srpski"));
});

/* ------------------------------------------------------------------ *
 * Go tekst za strukturirane podatke
 * ------------------------------------------------------------------ */

test("iz HTML-a se dobija go tekst, bez ijedne oznake", () => {
  assert.equal(
    tekstIzHtmla("<p>Dostava traje <strong>2–4</strong> dana.</p>"),
    "Dostava traje 2–4 dana.",
  );
});

test("entiteti se vraćaju u znakove, a razmaci sabijaju", () => {
  assert.equal(tekstIzHtmla("<p>Cena &lt; 2.000&nbsp;RSD  &amp;  više</p>"), "Cena < 2.000 RSD & više");
});

test("blokovi se razdvajaju razmakom, a ne lepe jedan za drugi", () => {
  assert.equal(tekstIzHtmla("<li>Prvo</li><li>Drugo</li>"), "Prvo Drugo");
});
