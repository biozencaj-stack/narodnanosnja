/**
 * Četiri presečne grupe opcija koje nosi SVAKA sekcija.
 *
 * Zahvaljujući njima WoodMart elementi „Title“, „Section divider“, „Gradients“
 * i zajednička podešavanja razmaka nisu zasebni poslovi nego polja koja svaki
 * tip dobija besplatno.
 */

import {
  type Lokalizovano,
  type PoljeSekcije,
  type TokenPozadine,
  type TokenTeksta,
  type TokenUkrasa,
  lok,
  prazanTekst,
} from "./polja";

/* ------------------------------------------------------------------ *
 * 1. Zaglavlje
 * ------------------------------------------------------------------ */

export const PORAVNANJA = [
  { vrednost: "levo", natpis: "Levo" },
  { vrednost: "centar", natpis: "Sredina" },
] as const;

export const NIVOI_NASLOVA = [
  { vrednost: "h1", natpis: "H1 — glavni naslov stranice" },
  { vrednost: "h2", natpis: "H2 — naslov sekcije" },
  { vrednost: "h3", natpis: "H3 — podnaslov" },
] as const;

export type Poravnanje = (typeof PORAVNANJA)[number]["vrednost"];
export type NivoNaslova = (typeof NIVOI_NASLOVA)[number]["vrednost"];

export interface VrednostiZaglavlja {
  nadnaslov: Lokalizovano;
  naslov: Lokalizovano;
  istaknutaRec: string;
  tekst: Lokalizovano;
  poravnanje: Poravnanje;
  nivoNaslova: NivoNaslova;
}

export const POLJA_ZAGLAVLJA: PoljeSekcije[] = [
  {
    kljuc: "nadnaslov",
    natpis: "Nadnaslov",
    opis: "Sitan tekst iznad naslova. Ostavite prazno ako nije potreban.",
    tip: "tekstLok",
    maxDuzina: 80,
  },
  { kljuc: "naslov", natpis: "Naslov", tip: "tekstLok", maxDuzina: 120 },
  {
    kljuc: "istaknutaRec",
    natpis: "Istaknuta reč",
    opis: "Reč iz naslova koja se boji primarnom bojom. Mora postojati u naslovu.",
    tip: "tekst",
    maxDuzina: 40,
  },
  { kljuc: "tekst", natpis: "Tekst ispod naslova", tip: "viselinijskiLok", maxDuzina: 400 },
  { kljuc: "poravnanje", natpis: "Poravnanje", tip: "izbor", opcije: PORAVNANJA },
  { kljuc: "nivoNaslova", natpis: "Nivo naslova", tip: "izbor", opcije: NIVOI_NASLOVA },
];

export const PODRAZUMEVANO_ZAGLAVLJE: VrednostiZaglavlja = {
  nadnaslov: prazanTekst(),
  naslov: prazanTekst(),
  istaknutaRec: "",
  tekst: prazanTekst(),
  poravnanje: "levo",
  nivoNaslova: "h2",
};

/* ------------------------------------------------------------------ *
 * 2. Pozadina i šara
 * ------------------------------------------------------------------ */

export const POZADINE = [
  { vrednost: "podloga", natpis: "Osnovna podloga" },
  { vrednost: "podlogaAlt", natpis: "Alternativna podloga" },
  { vrednost: "povrsina", natpis: "Površina kartice" },
  { vrednost: "tamna", natpis: "Tamna" },
] as const;

export const SARE = [
  { vrednost: "bez", natpis: "Bez šare" },
  { vrednost: "romb", natpis: "Romb sa krstom" },
  { vrednost: "rozeta", natpis: "Osmokraka rozeta" },
  { vrednost: "cikcak", natpis: "Cik-cak" },
  { vrednost: "krst", natpis: "Stepenasti krst" },
  { vrednost: "grana", natpis: "Grančica" },
  { vrednost: "kuka", natpis: "Kuka (meandar)" },
] as const;

export const BOJE_UKRASA = [
  { vrednost: "primarna", natpis: "Crvena" },
  { vrednost: "primarnaTamna", natpis: "Tamna crvena" },
  { vrednost: "zlatna", natpis: "Zlatna" },
  { vrednost: "zlatnaJaka", natpis: "Jaka zlatna" },
] as const;

export type Sara = (typeof SARE)[number]["vrednost"];

export interface VrednostiPozadine {
  pozadina: TokenPozadine;
  sara: Sara;
  saraVelicina: number;
  saraProzirnost: number;
  saraBoja: TokenUkrasa;
  saraBojaDruga: TokenUkrasa;
}

export const POLJA_POZADINE: PoljeSekcije[] = [
  { kljuc: "pozadina", natpis: "Pozadina", tip: "bojaPozadine" },
  { kljuc: "sara", natpis: "Tkana šara", tip: "izbor", opcije: SARE },
  {
    kljuc: "saraVelicina",
    natpis: "Veličina šare",
    opis: "U pikselima. Manja vrednost znači gušće tkanje.",
    tip: "broj",
    min: 16,
    max: 160,
    korak: 4,
  },
  {
    kljuc: "saraProzirnost",
    natpis: "Prozirnost šare",
    opis: "Od 0 do 1. Preko 0,2 šara počinje da se takmiči sa tekstom.",
    tip: "broj",
    min: 0,
    max: 1,
    korak: 0.005,
  },
  { kljuc: "saraBoja", natpis: "Boja šare", tip: "bojaUkrasa" },
  { kljuc: "saraBojaDruga", natpis: "Druga boja šare", tip: "bojaUkrasa" },
];

export const PODRAZUMEVANA_POZADINA: VrednostiPozadine = {
  pozadina: "podloga",
  sara: "bez",
  saraVelicina: 44,
  saraProzirnost: 0.07,
  saraBoja: "zlatna",
  saraBojaDruga: "primarna",
};

/**
 * Pozadina određuje shemu pisma. Admin ne bira boju teksta slobodno — time se
 * unapred isključuje nečitljiva kombinacija, a provera kontrasta ostaje kao
 * zaštita od izmene same palete.
 */
export function shemaTekstaZa(pozadina: TokenPozadine): {
  glavni: TokenTeksta;
  prigusen: TokenTeksta;
} {
  return pozadina === "tamna"
    ? { glavni: "svetli", prigusen: "svetliPrigusen" }
    : { glavni: "tekst", prigusen: "tekstPrigusen" };
}

/* ------------------------------------------------------------------ *
 * 3. Razdelnik
 * ------------------------------------------------------------------ */

export const RAZDELNICI = [
  { vrednost: "bez", natpis: "Bez razdelnika" },
  { vrednost: "traka", natpis: "Tkana traka" },
  { vrednost: "linija", natpis: "Tanka linija" },
] as const;

export type Razdelnik = (typeof RAZDELNICI)[number]["vrednost"];

export interface VrednostiRazdelnika {
  razdelnikGore: Razdelnik;
  razdelnikDole: Razdelnik;
  razdelnikVisina: number;
  razdelnikBoja: TokenUkrasa;
  razdelnikBojaDruga: TokenUkrasa;
}

export const POLJA_RAZDELNIKA: PoljeSekcije[] = [
  { kljuc: "razdelnikGore", natpis: "Razdelnik iznad", tip: "izbor", opcije: RAZDELNICI },
  { kljuc: "razdelnikDole", natpis: "Razdelnik ispod", tip: "izbor", opcije: RAZDELNICI },
  {
    kljuc: "razdelnikVisina",
    natpis: "Visina trake",
    tip: "broj",
    min: 8,
    max: 48,
    korak: 1,
  },
  { kljuc: "razdelnikBoja", natpis: "Boja trake", tip: "bojaUkrasa" },
  { kljuc: "razdelnikBojaDruga", natpis: "Druga boja trake", tip: "bojaUkrasa" },
];

export const PODRAZUMEVANI_RAZDELNIK: VrednostiRazdelnika = {
  razdelnikGore: "bez",
  razdelnikDole: "bez",
  razdelnikVisina: 20,
  razdelnikBoja: "zlatna",
  razdelnikBojaDruga: "primarna",
};

/* ------------------------------------------------------------------ *
 * 4. Raspored
 * ------------------------------------------------------------------ */

/**
 * Razmaci su imenovani po ulozi, ne po veličini, i njihove vrednosti su
 * preuzete iz zatečene početne stranice — zato „visok“ i „uvodni“ nisu u
 * odnosu veći/manji nego su dva različita ritma (`py-16 lg:py-20` naspram
 * `py-14 lg:py-24`).
 */
export const RAZMACI = [
  { vrednost: "bez", natpis: "Bez razmaka" },
  { vrednost: "uzak", natpis: "Uzak — traka preko stranice" },
  { vrednost: "srednji", natpis: "Srednji — obična sekcija" },
  { vrednost: "visok", natpis: "Visok — istaknut blok" },
  { vrednost: "uvodni", natpis: "Uvodni — vrh stranice" },
] as const;

export const ANIMACIJE = [
  { vrednost: "bez", natpis: "Bez animacije" },
  { vrednost: "blago", natpis: "Blago pojavljivanje" },
  { vrednost: "odozdo", natpis: "Klizanje odozdo" },
] as const;

export type Razmak = (typeof RAZMACI)[number]["vrednost"];
export type Animacija = (typeof ANIMACIJE)[number]["vrednost"];

export interface VrednostiRasporeda {
  razmak: Razmak;
  animacija: Animacija;
  sidro: string;
}

export const POLJA_RASPOREDA: PoljeSekcije[] = [
  { kljuc: "razmak", natpis: "Razmak iznad i ispod", tip: "izbor", opcije: RAZMACI },
  {
    kljuc: "animacija",
    natpis: "Ulazna animacija",
    opis:
      "Pokreće se kad sekcija uđe u vidno polje. Poštuje podešavanje „smanji kretanje“ u sistemu.",
    tip: "izbor",
    opcije: ANIMACIJE,
  },
  {
    kljuc: "sidro",
    natpis: "Sidro",
    opis: "Ime za vezu unutar stranice, npr. `kako-nastaje`. Samo mala slova i crtica.",
    tip: "tekst",
    maxDuzina: 40,
  },
];

export const PODRAZUMEVAN_RASPORED: VrednostiRasporeda = {
  razmak: "srednji",
  animacija: "bez",
  sidro: "",
};

/** Sidro sme da sadrži samo ono što bezbedno stoji u `id` atributu i u URL-u. */
export const OBRAZAC_SIDRA = /^[a-z][a-z0-9-]{0,39}$/;

/* ------------------------------------------------------------------ *
 * Ceo okvir
 * ------------------------------------------------------------------ */

export type VrednostiOkvira = VrednostiZaglavlja &
  VrednostiPozadine &
  VrednostiRazdelnika &
  VrednostiRasporeda;

/** Polja okvira redom kojim se prikazuju u admin obrascu. */
export const POLJA_OKVIRA: PoljeSekcije[] = [
  ...POLJA_ZAGLAVLJA,
  ...POLJA_POZADINE,
  ...POLJA_RAZDELNIKA,
  ...POLJA_RASPOREDA,
];

export const PODRAZUMEVAN_OKVIR: VrednostiOkvira = {
  ...PODRAZUMEVANO_ZAGLAVLJE,
  ...PODRAZUMEVANA_POZADINA,
  ...PODRAZUMEVANI_RAZDELNIK,
  ...PODRAZUMEVAN_RASPORED,
};

/** Ključevi okvira — koristi ih validator da odvoji okvir od polja tipa. */
export const KLJUCEVI_OKVIRA = new Set(POLJA_OKVIRA.map((polje) => polje.kljuc));

/**
 * Grupe za admin obrazac. Sekcija nema stotinu polja u jednoj koloni nego
 * četiri sklopiva bloka, kao što `StoreSettingsPanel` grupiše podešavanja.
 */
export const GRUPE_OKVIRA = [
  { sifra: "zaglavlje", natpis: "Zaglavlje", polja: POLJA_ZAGLAVLJA },
  { sifra: "pozadina", natpis: "Pozadina i šara", polja: POLJA_POZADINE },
  { sifra: "razdelnik", natpis: "Razdelnici", polja: POLJA_RAZDELNIKA },
  { sifra: "raspored", natpis: "Raspored", polja: POLJA_RASPOREDA },
] as const;

/** Prazno zaglavlje se ne renderuje — nema praznog `h2` u izlazu. */
export function imaZaglavlje(vrednosti: Partial<VrednostiZaglavlja>): boolean {
  const { nadnaslov, naslov, tekst } = vrednosti;
  return Boolean(
    nadnaslov?.sr || nadnaslov?.en || naslov?.sr || naslov?.en || tekst?.sr || tekst?.en,
  );
}

/** Naslov sekcije u kojoj tekst nije lokalizovan — koristi se u admin listi. */
export function potpisSekcije(vrednosti: Partial<VrednostiZaglavlja>): string {
  return vrednosti.naslov?.sr || vrednosti.nadnaslov?.sr || "";
}

export { lok };
