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
  naziv: "Kategorije",
  opis:
    "Kartice kategorija koje su u admin panelu označene za prikaz u navigaciji.",
  grupa: "katalog",
  faza: 1,
  polja: [
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
    {
      kljuc: "broj",
      natpis: "Najviše kategorija",
      tip: "broj",
      min: 1,
      max: 24,
      korak: 1,
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    kolone: "3",
    broj: 6,
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
    "Proizvodi iz kataloga po zadatom izvoru. Cena se uvek čita sa servera pri " +
    "prikazu — sekcija je ne pamti.",
  grupa: "katalog",
  faza: 1,
  polja: [
    { kljuc: "upit", natpis: "Izvor proizvoda", tip: "upitProizvoda" },
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    upit: { izvor: "izdvojenoISnizeno", broj: 8 },
    kolone: "4",
  },
  stranice: STRANICE,
  asinhrona: true,
  kostur: "mrezaProizvoda",
  /**
   * Početna je `force-dynamic`, pa je svaki blok jedan nekeširani upit po
   * zahtevu, na serveru koji deli mašinu sa još tri aplikacije. Ograničenje
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
