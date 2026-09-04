import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { MAX_KVALITETA, MIN_KVALITETA } from "./profili";

/**
 * Nijedna komponenta ne sme proslediti `quality` van dozvoljenog opsega.
 *
 * `next.config.ts` već navodi `qualities: [70, 75]`, ali to ograničenje radi
 * **tiho**: vrednost van spiska ne obara izgradnju i ne prijavljuje ništa —
 * slika se samo posluži drugačije nego što je autor mislio. Zato provera stoji
 * ovde, gde pada u CI-ju sa imenom fajla i linijom.
 */

const KOREN = fileURLToPath(new URL("../../", import.meta.url));
const FASCIKLE = ["components", "app"];
const PRESKACI = new Set(["node_modules", ".next", "dist", "build"]);

function skupiFajlove(fascikla: string, skup: string[] = []): string[] {
  for (const unos of readdirSync(fascikla, { withFileTypes: true })) {
    if (PRESKACI.has(unos.name)) continue;
    const puna = path.join(fascikla, unos.name);
    if (unos.isDirectory()) {
      skupiFajlove(puna, skup);
    } else if (/\.(tsx|ts)$/.test(unos.name)) {
      skup.push(puna);
    }
  }
  return skup;
}

function dozvoljeneIzKonfiguracije(): number[] {
  const izvor = readFileSync(path.join(KOREN, "next.config.ts"), "utf8");
  const nadjeno = /qualities:\s*\[([^\]]*)\]/.exec(izvor);
  assert.ok(nadjeno, "next.config.ts više ne navodi `qualities`");
  return nadjeno[1]
    .split(",")
    .map((deo) => Number(deo.trim()))
    .filter((broj) => Number.isFinite(broj));
}

test("svaki `quality` u JSX-u je u opsegu i u next.config listi", () => {
  const dozvoljene = dozvoljeneIzKonfiguracije();
  const prekrsaji: string[] = [];

  for (const fascikla of FASCIKLE) {
    for (const fajl of skupiFajlove(path.join(KOREN, fascikla))) {
      const linije = readFileSync(fajl, "utf8").split("\n");
      linije.forEach((linija, indeks) => {
        const nadjeno = /\bquality=\{(\d+)\}/.exec(linija);
        if (!nadjeno) return;

        const vrednost = Number(nadjeno[1]);
        const relativna = path.relative(KOREN, fajl);

        if (vrednost < MIN_KVALITETA || vrednost > MAX_KVALITETA) {
          prekrsaji.push(
            `${relativna}:${indeks + 1} quality=${vrednost} je van [${MIN_KVALITETA}, ${MAX_KVALITETA}]`,
          );
          return;
        }
        if (!dozvoljene.includes(vrednost)) {
          prekrsaji.push(
            `${relativna}:${indeks + 1} quality=${vrednost} nije u next.config qualities [${dozvoljene.join(", ")}]`,
          );
        }
      });
    }
  }

  assert.deepEqual(prekrsaji, []);
});

test("opseg iz profila se poklapa sa next.config listom", () => {
  // Da se ne razmimoiđu: profil obrade i Next-ova optimizacija moraju da
  // govore o istim brojevima, inače se slika obradi na jednu vrednost a
  // poslužuje na drugu.
  for (const vrednost of dozvoljeneIzKonfiguracije()) {
    assert.ok(
      vrednost >= MIN_KVALITETA && vrednost <= MAX_KVALITETA,
      `next.config dozvoljava ${vrednost}, van [${MIN_KVALITETA}, ${MAX_KVALITETA}]`,
    );
  }
});
