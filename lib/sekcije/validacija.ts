/**
 * Validacija, normalizacija i sanitizacija konfiguracije sekcije.
 *
 * Tri čiste funkcije bez ijednog uvoza React-a i Prisme, pisane ručno umesto
 * kroz `zod`: `zod` nije deklarisan u `package.json` nego dolazi kao tranzitivna
 * razvojna zavisnost preko `eslint-config-next`, pa bi svaka instalacija bez
 * razvojnih paketa oborila rutu koja ga uvozi.
 *
 * Pravila koja se ne razblažuju:
 * - nepoznat `kind` se odbija;
 * - nepoznat ključ se TIHO odbacuje, da rollback koda ispred podataka ne obori
 *   sekciju upisanu novijom verzijom;
 * - bogat tekst se sanitizuje ovde, pri upisu, i PONOVO na render granici
 *   (`lib/sekcije/prikaz.ts`).
 */

import { colorContrastRatio } from "@/lib/config/store-settings-schema";
import { sanitizeLocalizedRichText } from "@/lib/security/html";
import { safeLinkTarget } from "@/lib/security/navigation";
import {
  IZVORI_PROIZVODA,
  MAX_PROIZVODA_U_BLOKU,
  OBRAZAC_PUTANJE_MEDIJA,
  OBRAZAC_SLUGA,
  SORTIRANJA_PROIZVODA,
  TOKENI_POZADINE,
  TOKENI_TEKSTA,
  TOKENI_UKRASA,
  type Lokalizovano,
  type PoljeSekcije,
  jeObicanObjekat,
  prazanTekst,
} from "./polja";
import {
  OBRAZAC_SIDRA,
  shemaTekstaZa,
  type VrednostiOkvira,
} from "./okvir";
import { poljaTipa, tipSekcije } from "./registar";

/** Najveća serijalizovana veličina jedne konfiguracije. */
export const MAX_BAJTOVA_KONFIGURACIJE = 64 * 1024;

/** Najmanji prihvatljiv odnos kontrasta za tekst normalne veličine. */
export const MIN_KONTRAST_TEKSTA = 4.5;

export interface IshodValidacije {
  vrednosti: Record<string, unknown>;
  greske: Record<string, string>;
}

/** Jednolinijsko polje: nijedan kontrolni znak nije dozvoljen. */
const KONTROLNI_ZNAK = /[\u0000-\u001f\u007f]/;

/**
 * Lokalizovan tekst sme da sadrži prelom reda: naslov uvodnog bloka ga
 * stvarno koristi, a i tekst ispod naslova je višelinijski. Sve ostalo
 * (tab, povratak kolone, escape) i dalje pada.
 */
const KONTROLNI_OSIM_NOVOG_REDA = /[\u0000-\u0009\u000b-\u001f\u007f]/;

/* ------------------------------------------------------------------ *
 * Sitni čitači
 * ------------------------------------------------------------------ */

function citajTekst(vrednost: unknown): string | null {
  if (typeof vrednost !== "string") return null;
  if (KONTROLNI_ZNAK.test(vrednost)) return null;
  return vrednost.trim();
}

function citajRed(vrednost: unknown): string | null {
  if (typeof vrednost !== "string") return null;
  if (KONTROLNI_OSIM_NOVOG_REDA.test(vrednost)) return null;
  return vrednost.trim();
}

function citajLokalizovano(vrednost: unknown): Lokalizovano | null {
  if (typeof vrednost === "string") {
    const tekst = citajRed(vrednost);
    return tekst === null ? null : { sr: tekst, en: tekst };
  }
  if (!jeObicanObjekat(vrednost)) return null;

  const sr = citajRed(vrednost.sr ?? "");
  const en = citajRed(vrednost.en ?? "");
  if (sr === null || en === null) return null;
  return { sr, en };
}

/**
 * Vrednost polja `upitProizvoda`.
 *
 * Slugovi ulaze u `where` klauzulu sastavljenu od admin unosa, pa se proveravaju
 * oblikom, a ne samo tipom. Izvor koji traži dopunu (kategorija, brend, ručni
 * izbor) bez nje se odbija: bez te provere bi blok tiho pao na prazan filter i
 * prikazao ceo katalog umesto izabranog dela.
 */
function validirajUpitProizvoda(
  sirovo: unknown,
  put: string,
  greske: Record<string, string>,
): Record<string, unknown> {
  const izvorno = jeObicanObjekat(sirovo) ? sirovo : {};
  if (!jeObicanObjekat(sirovo)) {
    greske[put] = "Očekuje se izvor proizvoda";
  }

  const izvor =
    typeof izvorno.izvor === "string" &&
    (IZVORI_PROIZVODA as readonly string[]).includes(izvorno.izvor)
      ? izvorno.izvor
      : null;
  if (!izvor) {
    greske[`${put}.izvor`] = `Dozvoljeno: ${IZVORI_PROIZVODA.join(", ")}`;
  }

  const sort =
    typeof izvorno.sort === "string" &&
    (SORTIRANJA_PROIZVODA as readonly string[]).includes(izvorno.sort)
      ? izvorno.sort
      : null;
  if (izvorno.sort !== undefined && !sort) {
    greske[`${put}.sort`] = `Dozvoljeno: ${SORTIRANJA_PROIZVODA.join(", ")}`;
  }

  const broj = citajBroj(izvorno.broj);
  const brojJeDobar =
    broj !== null &&
    Number.isInteger(broj) &&
    broj >= 1 &&
    broj <= MAX_PROIZVODA_U_BLOKU;
  if (!brojJeDobar) {
    greske[`${put}.broj`] =
      `Broj proizvoda mora biti ceo broj od 1 do ${MAX_PROIZVODA_U_BLOKU}`;
  }

  const slug = (vrednost: unknown): string =>
    typeof vrednost === "string" && OBRAZAC_SLUGA.test(vrednost) ? vrednost : "";

  const kategorija = slug(izvorno.kategorija);
  if (izvor === "kategorija" && kategorija.length === 0) {
    greske[`${put}.kategorija`] = "Izaberi kategoriju";
  }

  const brend = slug(izvorno.brend);
  if (izvor === "brend" && brend.length === 0) {
    greske[`${put}.brend`] = "Izaberi brend";
  }

  const izabrani: string[] = [];
  if (Array.isArray(izvorno.izabrani)) {
    for (const stavka of izvorno.izabrani) {
      const vrednost = slug(stavka);
      if (vrednost.length === 0) {
        greske[`${put}.izabrani`] = "Nedozvoljen oblik sluga proizvoda";
        continue;
      }
      if (!izabrani.includes(vrednost)) izabrani.push(vrednost);
    }
    if (izvorno.izabrani.length > MAX_PROIZVODA_U_BLOKU) {
      greske[`${put}.izabrani`] = `Najviše ${MAX_PROIZVODA_U_BLOKU} proizvoda`;
    }
  } else if (izvorno.izabrani !== undefined) {
    greske[`${put}.izabrani`] = "Očekuje se lista slugova";
  }
  if (izvor === "izabrani" && izabrani.length === 0) {
    greske[`${put}.izabrani`] = "Dodaj bar jedan proizvod";
  }

  return {
    izvor: izvor ?? IZVORI_PROIZVODA[0],
    broj: brojJeDobar ? Math.trunc(broj as number) : 8,
    sort: sort ?? SORTIRANJA_PROIZVODA[0],
    kategorija,
    brend,
    izabrani: izabrani.slice(0, MAX_PROIZVODA_U_BLOKU),
  };
}

/** Bogat tekst zadržava prelome redova, pa nema `trim` po znaku. */
function citajBogatTekst(vrednost: unknown): Lokalizovano | null {
  if (typeof vrednost === "string") return { sr: vrednost, en: vrednost };
  if (!jeObicanObjekat(vrednost)) return null;
  const sr = vrednost.sr ?? "";
  const en = vrednost.en ?? "";
  if (typeof sr !== "string" || typeof en !== "string") return null;
  return { sr, en };
}

function citajBroj(vrednost: unknown): number | null {
  if (typeof vrednost !== "number" || !Number.isFinite(vrednost)) return null;
  return vrednost;
}

/* ------------------------------------------------------------------ *
 * Validacija jednog polja
 * ------------------------------------------------------------------ */

function validirajPolje(
  polje: PoljeSekcije,
  sirovo: unknown,
  put: string,
  greske: Record<string, string>,
): unknown {
  switch (polje.tip) {
    case "tekst": {
      const tekst = citajTekst(sirovo ?? "");
      if (tekst === null) {
        greske[put] = "Očekuje se običan tekst";
        return "";
      }
      if (polje.obavezno && !tekst) greske[put] = "Polje je obavezno";
      if (polje.maxDuzina && tekst.length > polje.maxDuzina) {
        greske[put] = `Najviše ${polje.maxDuzina} znakova`;
      }
      return tekst;
    }

    case "tekstLok":
    case "viselinijskiLok": {
      const vrednost = citajLokalizovano(sirovo ?? prazanTekst());
      if (!vrednost) {
        greske[put] = "Očekuje se tekst na srpskom i engleskom";
        return prazanTekst();
      }
      if (polje.obavezno && !vrednost.sr) {
        greske[`${put}.sr`] = "Srpski tekst je obavezan";
      }
      if (polje.maxDuzina) {
        if (vrednost.sr.length > polje.maxDuzina) {
          greske[`${put}.sr`] = `Najviše ${polje.maxDuzina} znakova`;
        }
        if (vrednost.en.length > polje.maxDuzina) {
          greske[`${put}.en`] = `Najviše ${polje.maxDuzina} znakova`;
        }
      }
      return vrednost;
    }

    case "bogatTekstLok": {
      const vrednost = citajBogatTekst(sirovo ?? prazanTekst());
      if (!vrednost) {
        greske[put] = "Očekuje se tekst na srpskom i engleskom";
        return prazanTekst();
      }
      if (polje.maxDuzina) {
        if (vrednost.sr.length > polje.maxDuzina) {
          greske[`${put}.sr`] = `Najviše ${polje.maxDuzina} znakova`;
        }
        if (vrednost.en.length > polje.maxDuzina) {
          greske[`${put}.en`] = `Najviše ${polje.maxDuzina} znakova`;
        }
      }
      // Sanitizacija se radi u `sanitizujSekciju`; ovde se samo meri dužina.
      return vrednost;
    }

    case "broj": {
      const broj = citajBroj(sirovo);
      if (broj === null) {
        greske[put] = "Unesite ispravan broj";
        return polje.min ?? 0;
      }
      if (polje.min !== undefined && broj < polje.min) {
        greske[put] = `Najmanja vrednost je ${polje.min}`;
      }
      if (polje.max !== undefined && broj > polje.max) {
        greske[put] = `Najveća vrednost je ${polje.max}`;
      }
      return broj;
    }

    case "prekidac": {
      if (typeof sirovo !== "boolean") {
        greske[put] = "Očekuje se uključeno ili isključeno";
        return false;
      }
      return sirovo;
    }

    case "izbor": {
      const dozvoljene = polje.opcije.map((o) => o.vrednost);
      if (typeof sirovo !== "string" || !dozvoljene.includes(sirovo)) {
        greske[put] = `Dozvoljeno: ${dozvoljene.join(", ")}`;
        return dozvoljene[0];
      }
      return sirovo;
    }

    case "bojaPozadine": {
      if (typeof sirovo !== "string" || !(sirovo in TOKENI_POZADINE)) {
        greske[put] = "Boja mora biti iz palete prodavnice";
        return "podloga";
      }
      return sirovo;
    }

    case "bojaUkrasa": {
      if (typeof sirovo !== "string" || !(sirovo in TOKENI_UKRASA)) {
        greske[put] = "Boja mora biti iz palete prodavnice";
        return "zlatna";
      }
      return sirovo;
    }

    case "medij": {
      if (sirovo === null || sirovo === undefined) return null;
      return validirajMedij(sirovo, put, greske);
    }

    case "medijLista": {
      if (sirovo === null || sirovo === undefined) return [];
      if (!Array.isArray(sirovo)) {
        greske[put] = "Očekuje se lista slika";
        return [];
      }
      if (sirovo.length > polje.maxStavki) {
        greske[put] = `Najviše ${polje.maxStavki} slika`;
      }
      return sirovo
        .slice(0, polje.maxStavki)
        .map((stavka, i) => validirajMedij(stavka, `${put}[${i}]`, greske))
        .filter((stavka) => stavka !== null);
    }

    case "veza": {
      if (sirovo === null || sirovo === undefined) {
        if (polje.obavezno) greske[put] = "Veza je obavezna";
        return null;
      }
      if (!jeObicanObjekat(sirovo)) {
        greske[put] = "Očekuje se veza";
        return null;
      }
      const url = safeLinkTarget(sirovo.url);
      if (!url) {
        greske[`${put}.url`] =
          "Dozvoljena je putanja u prodavnici, sidro na stranici ili http(s) adresa";
        return null;
      }
      return { url, noviTab: sirovo.noviTab === true };
    }

    case "upitProizvoda":
      return validirajUpitProizvoda(sirovo, put, greske);

    case "lista": {
      if (sirovo === null || sirovo === undefined) return [];
      if (!Array.isArray(sirovo)) {
        greske[put] = "Očekuje se lista";
        return [];
      }
      if (sirovo.length > polje.maxStavki) {
        greske[put] = `Najviše ${polje.maxStavki} stavki`;
      }
      return sirovo.slice(0, polje.maxStavki).map((stavka, i) => {
        const izvor = jeObicanObjekat(stavka) ? stavka : {};
        const rezultat: Record<string, unknown> = {};
        for (const podpolje of polje.stavka) {
          rezultat[podpolje.kljuc] = validirajPolje(
            podpolje,
            izvor[podpolje.kljuc],
            `${put}[${i}].${podpolje.kljuc}`,
            greske,
          );
        }
        return rezultat;
      });
    }
  }
}

function validirajMedij(
  sirovo: unknown,
  put: string,
  greske: Record<string, string>,
): Record<string, unknown> | null {
  if (!jeObicanObjekat(sirovo)) {
    greske[put] = "Očekuje se slika iz medijateke";
    return null;
  }

  const putanja = typeof sirovo.putanja === "string" ? sirovo.putanja : "";
  if (!OBRAZAC_PUTANJE_MEDIJA.test(putanja)) {
    greske[`${put}.putanja`] = "Slika mora doći iz medijateke";
    return null;
  }

  const dekorativna = sirovo.dekorativna === true;
  const alt = citajLokalizovano(sirovo.alt ?? prazanTekst()) ?? prazanTekst();
  if (!dekorativna && !alt.sr) {
    greske[`${put}.alt.sr`] =
      "Opis slike je obavezan; označite je kao ukrasnu ako ništa ne saopštava";
  }

  return { putanja, alt, dekorativna };
}

/* ------------------------------------------------------------------ *
 * Kontrast
 * ------------------------------------------------------------------ */

/**
 * Proverava par (boja teksta, boja pozadine) koji sekcija stvarno koristi.
 *
 * `validateStoreThemeContrast` proverava samo fiksne parove tema-nivoa i par
 * koji sekcija bira uopšte ne vidi. Provera radi nad PODRAZUMEVANOM paletom;
 * ako admin izmeni paletu u podešavanjima, tamošnja provera je ta koja važi.
 */
export function proveriKontrastSekcije(
  pozadina: unknown,
): { ok: true } | { ok: false; poruka: string } {
  if (typeof pozadina !== "string" || !(pozadina in TOKENI_POZADINE)) {
    return { ok: false, poruka: "Nepoznata pozadina" };
  }

  const pozadinaHex = TOKENI_POZADINE[pozadina as keyof typeof TOKENI_POZADINE];
  const shema = shemaTekstaZa(pozadina as keyof typeof TOKENI_POZADINE);

  for (const token of [shema.glavni, shema.prigusen] as const) {
    const odnos = colorContrastRatio(TOKENI_TEKSTA[token], pozadinaHex);
    if (odnos === null || odnos < MIN_KONTRAST_TEKSTA) {
      return {
        ok: false,
        poruka: `Tekst na ovoj pozadini ima kontrast ispod ${MIN_KONTRAST_TEKSTA}:1`,
      };
    }
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Javne funkcije
 * ------------------------------------------------------------------ */

/**
 * Proverava celu konfiguraciju sekcije. Vraća očišćene vrednosti i mapu
 * grešaka po putanji polja; prazna mapa znači da je upis dozvoljen.
 */
export function validirajSekciju(
  kind: string,
  konfiguracija: unknown,
): IshodValidacije {
  const greske: Record<string, string> = {};
  const tip = tipSekcije(kind);

  if (!tip) {
    return { vrednosti: {}, greske: { kind: `Nepoznat tip sekcije: ${kind}` } };
  }
  if (!jeObicanObjekat(konfiguracija)) {
    return { vrednosti: {}, greske: { config: "Očekuje se objekat" } };
  }

  const vrednosti: Record<string, unknown> = {};
  for (const polje of poljaTipa(tip)) {
    const sirovo = Object.prototype.hasOwnProperty.call(konfiguracija, polje.kljuc)
      ? konfiguracija[polje.kljuc]
      : (tip.podrazumevano as Record<string, unknown>)[polje.kljuc];
    vrednosti[polje.kljuc] = validirajPolje(polje, sirovo, polje.kljuc, greske);
  }

  // Sidro mora biti bezbedno i u `id` atributu i u URL-u.
  const sidro = vrednosti.sidro;
  if (typeof sidro === "string" && sidro && !OBRAZAC_SIDRA.test(sidro)) {
    greske.sidro = "Dozvoljena su mala slova, cifre i crtica; počinje slovom";
  }

  // Istaknuta reč se boji unutar naslova — ako je nema u naslovu, tiho bi
  // nestala i admin ne bi znao zašto.
  const istaknuta = vrednosti.istaknutaRec;
  const naslov = vrednosti.naslov as Lokalizovano | undefined;
  if (typeof istaknuta === "string" && istaknuta && naslov && !naslov.sr.includes(istaknuta)) {
    greske.istaknutaRec = "Ova reč ne postoji u naslovu";
  }

  const kontrast = proveriKontrastSekcije(vrednosti.pozadina);
  if (!kontrast.ok) greske.pozadina = kontrast.poruka;

  if (JSON.stringify(vrednosti).length > MAX_BAJTOVA_KONFIGURACIJE) {
    greske.config = "Konfiguracija sekcije je prevelika";
  }

  return { vrednosti, greske };
}

/**
 * Popunjava vrednosti koje nedostaju i odbacuje nepoznate ključeve, bez ijedne
 * greške. Poziva se i pri ČITANJU, pa red upisan pre nego što je novo polje
 * dodato u registar i dalje renderuje ispravno.
 */
export function normalizujSekciju(
  kind: string,
  konfiguracija: unknown,
): Record<string, unknown> {
  const tip = tipSekcije(kind);
  if (!tip) return {};

  const izvor = jeObicanObjekat(konfiguracija) ? konfiguracija : {};
  const odbaceno: Record<string, string> = {};
  const vrednosti: Record<string, unknown> = {};

  for (const polje of poljaTipa(tip)) {
    const podrazumevano = (tip.podrazumevano as Record<string, unknown>)[polje.kljuc];
    if (!Object.prototype.hasOwnProperty.call(izvor, polje.kljuc)) {
      vrednosti[polje.kljuc] = structuredClone(podrazumevano ?? null);
      continue;
    }

    const preGresaka = Object.keys(odbaceno).length;
    const ociscena = validirajPolje(polje, izvor[polje.kljuc], polje.kljuc, odbaceno);
    vrednosti[polje.kljuc] =
      Object.keys(odbaceno).length === preGresaka
        ? ociscena
        : structuredClone(podrazumevano ?? ociscena);
  }

  return vrednosti;
}

/**
 * Provlači svako bogato tekstualno polje kroz allow-listu iz
 * `lib/security/html.ts`. Poziva se PRI UPISU; render granica sanitizuje
 * ponovo, jer u bazu red može ući i mimo ove putanje — kroz seed, ručni SQL
 * ili restore starijeg dampa.
 */
export function sanitizujSekciju(
  kind: string,
  konfiguracija: unknown,
): Record<string, unknown> {
  const tip = tipSekcije(kind);
  if (!tip) return {};

  const izvor = jeObicanObjekat(konfiguracija) ? { ...konfiguracija } : {};

  const obidji = (polja: PoljeSekcije[], cvor: Record<string, unknown>) => {
    for (const polje of polja) {
      if (polje.tip === "bogatTekstLok") {
        cvor[polje.kljuc] = sanitizeLocalizedRichText(cvor[polje.kljuc]) ?? prazanTekst();
        continue;
      }
      if (polje.tip === "lista" && Array.isArray(cvor[polje.kljuc])) {
        const stavke = cvor[polje.kljuc] as unknown[];
        cvor[polje.kljuc] = stavke.map((stavka) => {
          if (!jeObicanObjekat(stavka)) return stavka;
          const kopija = { ...stavka };
          obidji(polje.stavka, kopija);
          return kopija;
        });
      }
    }
  };

  obidji(poljaTipa(tip), izvor);
  return izvor;
}

export type { VrednostiOkvira };
