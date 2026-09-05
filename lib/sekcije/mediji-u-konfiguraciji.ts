/**
 * Pronalaženje svih medija u konfiguraciji jedne sekcije.
 *
 * Putanja slike stoji na proizvoljnoj dubini `config`-a i pod različitim
 * ključevima po tipu sekcije. Nijedan jsonb filter ne nalazi string na
 * proizvoljnoj dubini, pa se upotrebe moraju izvući u aplikaciji i upisati u
 * `MediaAssetUsage`. Bez toga provera reference ili tiho promaši i dozvoli
 * brisanje slike sa žive početne, ili odbija brisanje svega.
 *
 * Obilazak ide po definiciji polja iz registra, ne po sadržaju: tako se ne može
 * desiti da se kao „medij” protumači običan tekst koji slučajno liči na putanju.
 */

import { OBRAZAC_PUTANJE_MEDIJA, jeObicanObjekat } from "./polja";
import type { PoljeSekcije } from "./polja";
import { poljaTipa, tipSekcije } from "./registar";

export interface UpotrebaMedija {
  /** Putanja polja u konfiguraciji, npr. `stavke[2].ikona`. */
  polje: string;
  /** Vrednost `putanja` iz `VrednostMedija`. */
  putanja: string;
}

function putanjaIzVrednosti(vrednost: unknown): string | null {
  if (!jeObicanObjekat(vrednost)) return null;
  const putanja = vrednost.putanja;
  if (typeof putanja !== "string") return null;
  // Isti obraz kao CHECK nad `MediaAsset.path`. Vrednost koja ga ne zadovolji
  // nije upotreba medija nego smeće, i ne sme da napravi red u bazi.
  return OBRAZAC_PUTANJE_MEDIJA.test(putanja) ? putanja : null;
}

function obidjiPolja(
  polja: PoljeSekcije[],
  cvor: Record<string, unknown>,
  prefiks: string,
  skup: UpotrebaMedija[],
): void {
  for (const polje of polja) {
    const vrednost = cvor[polje.kljuc];
    const kljuc = prefiks ? `${prefiks}.${polje.kljuc}` : polje.kljuc;

    if (polje.tip === "medij") {
      const putanja = putanjaIzVrednosti(vrednost);
      if (putanja) skup.push({ polje: kljuc, putanja });
      continue;
    }

    if (polje.tip === "medijLista") {
      if (!Array.isArray(vrednost)) continue;
      vrednost.forEach((stavka, indeks) => {
        const putanja = putanjaIzVrednosti(stavka);
        if (putanja) skup.push({ polje: `${kljuc}[${indeks}]`, putanja });
      });
      continue;
    }

    if (polje.tip === "lista") {
      if (!Array.isArray(vrednost)) continue;
      vrednost.forEach((stavka, indeks) => {
        if (!jeObicanObjekat(stavka)) return;
        obidjiPolja(polje.stavka, stavka, `${kljuc}[${indeks}]`, skup);
      });
    }
  }
}

/**
 * Upotrebe medija u jednoj konfiguraciji, bez ponavljanja po polju.
 *
 * Isto polje ne može da se pojavi dvaput — `MediaAssetUsage` ima jedinstven
 * indeks nad `(sectionId, polje)`, pa bi duplikat oborio upis.
 */
export function medijiUKonfiguraciji(
  kind: string,
  konfiguracija: unknown,
): UpotrebaMedija[] {
  const tip = tipSekcije(kind);
  if (!tip || !jeObicanObjekat(konfiguracija)) return [];

  const skup: UpotrebaMedija[] = [];
  obidjiPolja(poljaTipa(tip), konfiguracija, "", skup);

  const videna = new Set<string>();
  return skup.filter((upotreba) => {
    if (videna.has(upotreba.polje)) return false;
    videna.add(upotreba.polje);
    return true;
  });
}
