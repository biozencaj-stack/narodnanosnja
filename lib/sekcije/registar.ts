/**
 * Registar tipova sekcija — jedini autoritet nad oblikom konfiguracije.
 *
 * Iz njega se generiše admin obrazac, iz njega validator zna šta sme da uđe u
 * bazu, i iz njega renderer zna koju komponentu da pozove. Novi tip sekcije je
 * jedan unos ovde plus jedna prezentaciona komponenta — ništa drugo.
 *
 * Mapa `kind -> komponenta` NIJE ovde nego u `components/sekcije/index.tsx`,
 * da admin paket ne povuče ceo storefront.
 */

import {
  type PoljeSekcije,
  lok,
  prazanTekst,
} from "./polja";
import { PODRAZUMEVAN_UPIT } from "./upit-proizvoda";
import {
  PODRAZUMEVAN_OKVIR,
  POLJA_OKVIRA,
  type VrednostiOkvira,
} from "./okvir";

export const STRANICE = ["home"] as const;
export type KljucStranice = (typeof STRANICE)[number];

export interface TipSekcije {
  /** Vrednost kolone `kind`. Mala slova, bez razmaka. */
  kind: string;
  naziv: string;
  opis: string;
  /** Grupa u biraču „dodaj sekciju“. */
  grupa: "sadrzaj" | "katalog";
  /** Faza plana u kojoj je tip isporučen — vidi docs/PLAN-SEKCIJE.md. */
  faza: number;
  /** Polja specifična za ovaj tip. Polja okvira se dodaju automatski. */
  polja: PoljeSekcije[];
  /** Cela podrazumevana konfiguracija, uključujući okvir. */
  podrazumevano: Record<string, unknown>;
  stranice: readonly KljucStranice[];
  /** Da li render čita bazu — određuje da li ide u sopstveni `Suspense`. */
  asinhrona: boolean;
  /** Kostur dok se čeka; ime obrađuje renderer. */
  kostur?: "mrezaProizvoda" | "mrezaKartica";
  /** Tvrdo ograničenje broja sekcija ovog tipa po stranici. */
  maxPoStrani?: number;
}

/* ------------------------------------------------------------------ *
 * Zajedničke liste izbora
 * ------------------------------------------------------------------ */

const KOLONE = [
  { vrednost: "2", natpis: "2 u redu" },
  { vrednost: "3", natpis: "3 u redu" },
  { vrednost: "4", natpis: "4 u redu" },
] as const;

/**
 * Kolone na telefonu se biraju odvojeno od desktopa. Jedna kolona daje veliku
 * fotografiju i koristi se za malobrojne, skupe komade; dve su podrazumevane.
 */
const KOLONE_MOBILNO = [
  { vrednost: "1", natpis: "1 u redu" },
  { vrednost: "2", natpis: "2 u redu" },
] as const;

const STILOVI_DUGMETA = [
  { vrednost: "puno", natpis: "Puno dugme" },
  { vrednost: "obrub", natpis: "Samo obrub" },
  { vrednost: "obrubSvetli", natpis: "Svetli obrub (za tamnu pozadinu)" },
] as const;

/** Do dva dugmeta po sekciji; treće nikad nije pomoglo odluci kupca. */
const POLJE_DUGMADI: PoljeSekcije = {
  kljuc: "dugmad",
  natpis: "Dugmad",
  tip: "lista",
  maxStavki: 2,
  natpisStavke: "Dugme",
  stavka: [
    { kljuc: "natpis", natpis: "Natpis", tip: "tekstLok", maxDuzina: 40, obavezno: true },
    { kljuc: "veza", natpis: "Vodi na", tip: "veza", obavezno: true },
    { kljuc: "stil", natpis: "Stil", tip: "izbor", opcije: STILOVI_DUGMETA },
  ],
};

/* ------------------------------------------------------------------ *
 * Tipovi
 * ------------------------------------------------------------------ */

const NASLOV: TipSekcije = {
  kind: "naslov",
  naziv: "Naslov sekcije",
  opis: "Samostalno zaglavlje između dve sekcije, sa opcionim razdelnikom.",
  grupa: "sadrzaj",
  faza: 1,
  polja: [],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    naslov: lok("Novi naslov"),
  },
  stranice: STRANICE,
  asinhrona: false,
};

const HERO: TipSekcije = {
  kind: "hero",
  naziv: "Uvodni blok",
  opis:
    "Veliki uvod sa naslovom, tekstom i dugmadima. Prikaz „mozaik“ nosi i slike, " +
    "„centrirano“ je poziv na akciju preko cele širine.",
  grupa: "sadrzaj",
  faza: 1,
  polja: [
    {
      kljuc: "prikaz",
      natpis: "Prikaz",
      tip: "izbor",
      opcije: [
        { vrednost: "mozaik", natpis: "Tekst levo, slike desno" },
        { vrednost: "centrirano", natpis: "Sve centrirano, bez slika" },
      ],
    },
    POLJE_DUGMADI,
    {
      kljuc: "slike",
      natpis: "Slike",
      opis:
        "Do tri slike za mozaik. Dok ih nema, stoji tkana šara — nikad prazna kutija.",
      tip: "medijLista",
      maxStavki: 3,
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    nivoNaslova: "h1",
    razmak: "uvodni",
    prikaz: "mozaik",
    dugmad: [],
    slike: [],
  },
  stranice: STRANICE,
  asinhrona: false,
  maxPoStrani: 2,
};

const STAVKE: TipSekcije = {
  kind: "stavke",
  naziv: "Ponavljajuće stavke",
  opis:
    "Jedan repeater za više WoodMart elemenata: traka vrednosti, kartice sa " +
    "ikonom, i numerisani koraci postupka.",
  grupa: "sadrzaj",
  faza: 1,
  polja: [
    {
      kljuc: "prikaz",
      natpis: "Prikaz",
      tip: "izbor",
      opcije: [
        { vrednost: "traka", natpis: "Traka — sitna šara levo, tekst desno" },
        { vrednost: "kartice", natpis: "Kartice" },
        { vrednost: "koraci", natpis: "Numerisani koraci" },
      ],
    },
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
    {
      kljuc: "stavke",
      natpis: "Stavke",
      tip: "lista",
      maxStavki: 8,
      natpisStavke: "Stavka",
      stavka: [
        { kljuc: "naslov", natpis: "Naslov", tip: "tekstLok", maxDuzina: 80, obavezno: true },
        { kljuc: "tekst", natpis: "Tekst", tip: "viselinijskiLok", maxDuzina: 300 },
        {
          kljuc: "oznaka",
          natpis: "Oznaka",
          opis: "Za prikaz „koraci“ — na primer 01. Prazno znači bez oznake.",
          tip: "tekst",
          maxDuzina: 8,
        },
        {
          kljuc: "motiv",
          natpis: "Motiv šare",
          opis: "Redni broj motiva za prikaz „traka“. Isti broj uvek daje istu šaru.",
          tip: "broj",
          min: 0,
          max: 5,
          korak: 1,
        },
      ],
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    prikaz: "kartice",
    kolone: "4",
    stavke: [],
  },
  stranice: STRANICE,
  asinhrona: false,
};

const TAKSONOMIJA: TipSekcije = {
  kind: "taksonomija",
  naziv: "Kategorije i brendovi",
  opis:
    "Kartice kategorija označenih za navigaciju, ili kartice brendova. " +
    "Prikazuje sliku koju admin već unosi uz kategoriju odnosno brend.",
  grupa: "katalog",
  faza: 1,
  polja: [
    {
      kljuc: "izvor",
      natpis: "Šta se prikazuje",
      tip: "izbor",
      opcije: [
        { vrednost: "kategorije", natpis: "Kategorije iz navigacije" },
        { vrednost: "brendovi", natpis: "Brendovi sa bar jednim proizvodom" },
      ],
    },
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
    {
      kljuc: "broj",
      natpis: "Najviše kartica",
      tip: "broj",
      min: 1,
      max: 24,
      korak: 1,
    },
    {
      kljuc: "podkategorije",
      natpis: "Veze ka podkategorijama",
      opis:
        "Ispod naziva kategorije stoje i njene podkategorije. Brendovi nemaju " +
        "podelu, pa im ovo ne menja ništa.",
      tip: "prekidac",
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    izvor: "kategorije",
    kolone: "3",
    broj: 6,
    podkategorije: false,
  },
  stranice: STRANICE,
  asinhrona: true,
  kostur: "mrezaKartica",
};

const TEKST: TipSekcije = {
  kind: "tekst",
  naziv: "Bogati tekst",
  opis:
    "Slobodan tekst sa osnovnim oblikovanjem. Prolazi kroz istu belu listu " +
    "oznaka kao članci — bez tabela, ugradnji i stilova.",
  grupa: "sadrzaj",
  faza: 1,
  polja: [
    { kljuc: "sadrzaj", natpis: "Sadržaj", tip: "bogatTekstLok", maxDuzina: 8000 },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    sadrzaj: prazanTekst(),
  },
  stranice: STRANICE,
  asinhrona: false,
};

const PROIZVODI: TipSekcije = {
  kind: "proizvodi",
  naziv: "Blok proizvoda",
  opis:
    "Proizvodi iz kataloga po zadatom izvoru, kao mreža ili karusel. Cena se " +
    "uvek čita sa servera pri prikazu — sekcija je ne pamti.",
  grupa: "katalog",
  faza: 4,
  polja: [
    { kljuc: "upit", natpis: "Izvor proizvoda", tip: "upitProizvoda" },
    {
      kljuc: "tabovi",
      natpis: "Tabovi",
      opis:
        "Kad ima bar dva taba, gornji izvor se ne koristi — posetilac bira " +
        "između tabova. Jedan tab nije tab, pa se tada prikazuje samo gornji izvor.",
      tip: "lista",
      maxStavki: 4,
      natpisStavke: "Tab",
      stavka: [
        { kljuc: "naslov", natpis: "Natpis taba", tip: "tekstLok", maxDuzina: 40, obavezno: true },
        { kljuc: "upit", natpis: "Izvor proizvoda", tip: "upitProizvoda" },
      ],
    },
    {
      kljuc: "prikaz",
      natpis: "Prikaz",
      tip: "izbor",
      opcije: [
        { vrednost: "mreza", natpis: "Mreža" },
        { vrednost: "karusel", natpis: "Karusel koji klizi" },
      ],
    },
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
    {
      kljuc: "koloneMobilno",
      natpis: "Kolona na telefonu",
      tip: "izbor",
      opcije: KOLONE_MOBILNO,
    },
    {
      kljuc: "oznake",
      natpis: "Oznake „Novo” i popust",
      opis: "Isključi kad blok stoji uz drugi u kom oznake već stoje.",
      tip: "prekidac",
    },
    {
      kljuc: "zelje",
      natpis: "Dugme „sačuvaj u želje”",
      opis:
        "Isključi kad blok služi kao izlog, a ne kao mesto sa kog se kupuje. " +
        "Ako je funkcija želja ugašena u podešavanjima, dugmeta nema ni ovako.",
      tip: "prekidac",
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    upit: { ...PODRAZUMEVAN_UPIT },
    tabovi: [],
    prikaz: "mreza",
    kolone: "4",
    koloneMobilno: "2",
    oznake: true,
    zelje: true,
  },
  stranice: STRANICE,
  asinhrona: true,
  kostur: "mrezaProizvoda",
  /**
   * Početna je `force-dynamic`, pa je svaki blok najmanje jedan nekeširani upit
   * po zahtevu, na serveru koji deli mašinu sa još tri aplikacije. Ograničenje
   * sprovodi ruta, ne savet u sučelju.
   */
  maxPoStrani: 3,
};

/* ------------------------------------------------------------------ *
 * Javni registar
 * ------------------------------------------------------------------ */

export const TIPOVI_SEKCIJA: TipSekcije[] = [
  NASLOV,
  HERO,
  STAVKE,
  TAKSONOMIJA,
  TEKST,
  PROIZVODI,
];

const PO_KLJUCU = new Map(TIPOVI_SEKCIJA.map((tip) => [tip.kind, tip]));

export function tipSekcije(kind: string): TipSekcije | undefined {
  return PO_KLJUCU.get(kind);
}

export function postojiTip(kind: string): boolean {
  return PO_KLJUCU.has(kind);
}

/** Sva polja jednog tipa, redom kojim ih admin obrazac prikazuje. */
export function poljaTipa(tip: TipSekcije): PoljeSekcije[] {
  return [...tip.polja, ...POLJA_OKVIRA];
}

/** Sveža kopija podrazumevane konfiguracije — nikad zajednička referenca. */
export function podrazumevanaKonfiguracija(kind: string): Record<string, unknown> {
  const tip = PO_KLJUCU.get(kind);
  if (!tip) return {};
  return structuredClone(tip.podrazumevano);
}

export type KonfiguracijaSekcije = Record<string, unknown> & Partial<VrednostiOkvira>;
