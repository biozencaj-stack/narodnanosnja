/**
 * Tipovi polja od kojih se sastavlja šema jedne sekcije stranice.
 *
 * Ovaj modul je namerno bez ijednog uvoza React-a i Prisme, po uzoru na
 * `lib/config/store-settings-schema.ts`: isti fajl koristi i admin obrazac u
 * pregledaču i serverska validacija, pa ne sme povući ni jedno ni drugo.
 *
 * Vrednosti su uvek obična JSON struktura — nikad CSS klasa, nikad HTML.
 * Renderer je taj koji nabrojanu vrednost prevodi u fiksnu Tailwind klasu.
 */

/* ------------------------------------------------------------------ *
 * Jezici
 * ------------------------------------------------------------------ */

export const JEZICI = ["sr", "en"] as const;
export type Jezik = (typeof JEZICI)[number];

/** Lokalizovan tekst. `en` je opciono i pri prikazu pada nazad na `sr`. */
export type Lokalizovano = { sr: string; en: string };

/* ------------------------------------------------------------------ *
 * Tokeni boja
 * ------------------------------------------------------------------ */

/**
 * Zatvorena lista pozadina. HEX vrednosti odgovaraju podrazumevanoj paleti iz
 * `app/globals.css`; služe isključivo za proveru kontrasta pri validaciji.
 *
 * Napomena koja se ne sme izgubiti: runtime paleta dolazi iz `Setting` tabele
 * i admin je može promeniti, pa provera ovde dokazuje da je *podrazumevana*
 * kombinacija čitljiva. Provera stvarne, podešene palete je posao
 * `validateStoreThemeContrast` na strani podešavanja.
 */
export const TOKENI_POZADINE = {
  podloga: "#faf6ed",
  podlogaAlt: "#f2ead9",
  povrsina: "#fffdf6",
  tamna: "#2c231b",
} as const;

export type TokenPozadine = keyof typeof TOKENI_POZADINE;

/** Zatvorena lista boja teksta, po shemi (tamna podloga traži svetlo pismo). */
export const TOKENI_TEKSTA = {
  tekst: "#2c231b",
  tekstPrigusen: "#6d5c4a",
  svetli: "#fdf6e8",
  svetliPrigusen: "#ddcdb4",
} as const;

export type TokenTeksta = keyof typeof TOKENI_TEKSTA;

/** Boje ukrasa — šara i razdelnika. Dekorativne su, pa ne ulaze u kontrast. */
export const TOKENI_UKRASA = {
  primarna: "#a4161a",
  primarnaTamna: "#8c1c13",
  zlatna: "#b98f21",
  zlatnaJaka: "#d9b04a",
} as const;

export type TokenUkrasa = keyof typeof TOKENI_UKRASA;

/* ------------------------------------------------------------------ *
 * Vrednosti složenih polja
 * ------------------------------------------------------------------ */

/**
 * Slika iz medijateke. `alt` je deo vrednosti, a ne zasebno polje koje se
 * zaboravi; validator odbija sliku bez opisa osim kad je izričito dekorativna.
 * Do faze sa medijatekom vrednost ostaje `null`, a komponenta pada na tkanu
 * šaru — prazna kutija nije prihvatljivo stanje.
 */
export type VrednostMedija = {
  putanja: string;
  alt: Lokalizovano;
  dekorativna: boolean;
};

/** Veza. Interna putanja, sidro na istoj stranici, ili spoljni http(s) URL. */
export type VrednostVeze = {
  url: string;
  noviTab: boolean;
};

/** Izvori proizvoda koje faza 1 podržava. Ostale donosi blok proizvoda. */
export const IZVORI_PROIZVODA = [
  "izdvojeno",
  "snizeno",
  "izdvojenoISnizeno",
] as const;

export type IzvorProizvoda = (typeof IZVORI_PROIZVODA)[number];

export type VrednostUpitaProizvoda = {
  izvor: IzvorProizvoda;
  broj: number;
};

/* ------------------------------------------------------------------ *
 * Definicija polja
 * ------------------------------------------------------------------ */

export interface OsnovaPolja {
  /** Ključ u `config` objektu sekcije. */
  kljuc: string;
  /** Natpis u admin obrascu. */
  natpis: string;
  opis?: string;
  obavezno?: boolean;
}

export type PoljeSekcije =
  | (OsnovaPolja & { tip: "tekst"; maxDuzina?: number })
  | (OsnovaPolja & {
      tip: "tekstLok" | "viselinijskiLok" | "bogatTekstLok";
      maxDuzina?: number;
    })
  | (OsnovaPolja & { tip: "broj"; min?: number; max?: number; korak?: number })
  | (OsnovaPolja & { tip: "prekidac" })
  | (OsnovaPolja & {
      tip: "izbor";
      opcije: readonly { vrednost: string; natpis: string }[];
    })
  | (OsnovaPolja & { tip: "bojaPozadine" })
  | (OsnovaPolja & { tip: "bojaUkrasa" })
  | (OsnovaPolja & { tip: "medij" })
  | (OsnovaPolja & { tip: "medijLista"; maxStavki: number })
  | (OsnovaPolja & { tip: "veza" })
  | (OsnovaPolja & { tip: "upitProizvoda" })
  | (OsnovaPolja & {
      tip: "lista";
      stavka: PoljeSekcije[];
      maxStavki: number;
      natpisStavke: string;
    });

export type TipPolja = PoljeSekcije["tip"];

/* ------------------------------------------------------------------ *
 * Oblik putanje medija
 * ------------------------------------------------------------------ */

/**
 * Prvi znak imena fajla mora biti alfanumerik, pa se `.` i `..` ne mogu
 * provući. Isti izraz stoji i kao CHECK ograničenje nad `MediaAsset.path`.
 */
export const OBRAZAC_PUTANJE_MEDIJA =
  /^\/uploads\/[a-z0-9-]{1,32}\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

/* ------------------------------------------------------------------ *
 * Pomoćne funkcije nad vrednostima
 * ------------------------------------------------------------------ */

export function jeObicanObjekat(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Prazan lokalizovan tekst. */
export function prazanTekst(): Lokalizovano {
  return { sr: "", en: "" };
}

/** Iz srpskog teksta pravi lokalizovanu vrednost sa istim engleskim. */
export function lok(sr: string, en?: string): Lokalizovano {
  return { sr, en: en ?? sr };
}

/**
 * Čita lokalizovanu vrednost za dati jezik, uz pad na srpski. Nikad ne vraća
 * `undefined` — prazan string je jedina prazna vrednost.
 */
export function citajLok(vrednost: unknown, jezik: string): string {
  if (typeof vrednost === "string") return vrednost;
  if (!jeObicanObjekat(vrednost)) return "";
  const izabrani = vrednost[jezik];
  if (typeof izabrani === "string" && izabrani.length > 0) return izabrani;
  const srpski = vrednost.sr;
  return typeof srpski === "string" ? srpski : "";
}
