import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * Svaki karusel sa autoplayem mora imati vidljivo dugme za pauzu.
 *
 * WCAG 2.2.2: kretanje koje počne samo i traje duže od pet sekundi mora imati
 * mehanizam za zaustavljanje. `stopOnInteraction` ga ne zamenjuje — staje tek
 * kad posetilac dodirne sam sadržaj. Pauza na hover takođe ne prolazi: na
 * dodirnom ekranu hover ne postoji, a tastatura ga ne pokreće.
 *
 * Pravilo se lako izgubi pri sledećem karuselu, pa stoji kao test a ne samo
 * kao rečenica u dokumentaciji.
 */

const KOREN = fileURLToPath(new URL("../../", import.meta.url));
const PRESKACI = new Set(["node_modules", ".next", "dist", "build"]);

function skupiFajlove(fascikla: string, skup: string[] = []): string[] {
  for (const unos of readdirSync(fascikla, { withFileTypes: true })) {
    if (PRESKACI.has(unos.name)) continue;
    const puna = path.join(fascikla, unos.name);
    if (unos.isDirectory()) skupiFajlove(puna, skup);
    else if (unos.name.endsWith(".tsx")) skup.push(puna);
  }
  return skup;
}

test("komponenta sa autoplayem nudi pauzu", () => {
  const bezPauze: string[] = [];

  for (const fascikla of ["components", "app"]) {
    for (const fajl of skupiFajlove(path.join(KOREN, fascikla))) {
      const izvor = readFileSync(fajl, "utf8");

      const imaAutoplay =
        izvor.includes("embla-carousel-autoplay") ||
        /Autoplay\(\s*\{/.test(izvor);
      if (!imaAutoplay) continue;

      // Prihvata se ili sopstveno dugme sa `aria-pressed`, ili zajedničko
      // `DugmePauze`, koje ga i samo nosi.
      const imaPauzu =
        izvor.includes("aria-pressed") || izvor.includes("DugmePauze");

      if (!imaPauzu) bezPauze.push(path.relative(KOREN, fajl));
    }
  }

  assert.deepEqual(
    bezPauze,
    [],
    "karusel sa autoplayem bez dugmeta za pauzu pada WCAG 2.2.2",
  );
});
