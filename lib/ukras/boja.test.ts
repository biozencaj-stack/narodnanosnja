import assert from "node:assert/strict";
import test from "node:test";
import { jeHeksBoja, sigurnaBoja } from "./boja";

test("HEX u sva četiri dozvoljena oblika prolazi", () => {
  for (const boja of ["#fff", "#ffff", "#b98f21", "#b98f21cc", "#B98F21"]) {
    assert.equal(jeHeksBoja(boja), true, boja);
    assert.equal(sigurnaBoja(boja, "#000000"), boja);
  }
});

test("CSS promenljiva se odbija — u data: URI-ju ne postoji", () => {
  // Ovo je bila stvarna greška: traka u podnožju crtana je sa
  // var(--color-zlatna), pa su linije nestale a tačkice ispale crne.
  assert.equal(jeHeksBoja("var(--color-zlatna)"), false);
  assert.equal(sigurnaBoja("var(--color-zlatna)", "#b98f21"), "#b98f21");
});

test("imenovane i funkcijske boje se takođe odbijaju", () => {
  for (const boja of [
    "red",
    "currentColor",
    "rgb(185, 143, 33)",
    "hsl(45 70% 43%)",
    "color-mix(in srgb, red, blue)",
    "#12345",
    "#gggggg",
    "",
    " #b98f21",
    "#b98f21 ",
  ]) {
    assert.equal(jeHeksBoja(boja), false, boja);
    assert.equal(sigurnaBoja(boja, "#a4161a"), "#a4161a", boja);
  }
});

test("vrednost koja nije tekst pada na podrazumevanu", () => {
  for (const vrednost of [null, undefined, 42, {}, [], true]) {
    assert.equal(jeHeksBoja(vrednost), false, String(vrednost));
    assert.equal(sigurnaBoja(vrednost, "#a4161a"), "#a4161a", String(vrednost));
  }
});
