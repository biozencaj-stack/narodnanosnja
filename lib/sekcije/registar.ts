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
  IZVORI_STAVKI,
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

/**
 * Zone u koje admin sme da postavi sekciju.
 *
 * Jedna zona = jedan `pageKey` = jedan uređivački ekran. Stranica sa sadržajem
 * iznad i ispod ima DVE zone, a ne jednu sa poljem „gore/dole“: redosled je
 * svojstvo zone, pa bi jedan spisak morao da nosi i granicu između njih.
 *
 * Ključevi nemaju dvotačku. `stranica:<slug>` za proizvoljne stranice je i
 * dalje samo zamisao i CHECK nad `PageSection.pageKey` je namerno ne dozvoljava
 * — da u shemi ne stoji neispunjeno obećanje. Vidi `docs/PLAN-SEKCIJE.md`.
 */
export const STRANICE = [
  "home",
  "catalog-iznad",
  "catalog-ispod",
  "category-iznad",
  "category-ispod",
  "product-ispod",
  "not-found",
  "prefooter",
] as const;

export type KljucStranice = (typeof STRANICE)[number];

export interface OpisStranice {
  kljuc: KljucStranice;
  naziv: string;
  opis: string;
}

export const OPISI_STRANICA: OpisStranice[] = [
  {
    kljuc: "home",
    naziv: "Početna",
    opis: "Cela početna strana. Ovde nema sadržaja izvan sekcija.",
  },
  {
    kljuc: "catalog-iznad",
    naziv: "Katalog — iznad proizvoda",
    opis: "Između navigacije i naslova kataloga.",
  },
  {
    kljuc: "catalog-ispod",
    naziv: "Katalog — ispod proizvoda",
    opis: "Posle poslednje strane rezultata.",
  },
  {
    kljuc: "category-iznad",
    naziv: "Kategorija — iznad proizvoda",
    opis: "Na svakoj stranici kategorije, iznad spiska.",
  },
  {
    kljuc: "category-ispod",
    naziv: "Kategorija — ispod proizvoda",
    opis: "Na svakoj stranici kategorije, ispod spiska.",
  },
  {
    kljuc: "product-ispod",
    naziv: "Proizvod — ispod opisa",
    opis:
      "Ispod opisa i sličnih proizvoda. Iznad proizvoda nema zone namerno: " +
      "sve što stoji tamo gura sam proizvod ispod prvog ekrana.",
  },
  {
    kljuc: "not-found",
    naziv: "Stranica 404",
    opis: "Ono što vidi posetilac koji je stigao na adresu koje nema.",
  },
  {
    kljuc: "prefooter",
    naziv: "Iznad podnožja (sve stranice)",
    opis:
      "Renderuje se na SVAKOJ stranici prodavnice. Zato ovde nema tipova koji " +
      "čitaju katalog — oni bi radili upit na svakom pogotku.",
  },
];

const KLJUCEVI_STRANICA = new Set<string>(STRANICE);

export function postojiStranica(pageKey: string): pageKey is KljucStranice {
  return KLJUCEVI_STRANICA.has(pageKey);
}

export function opisStranice(pageKey: string): OpisStranice | undefined {
  return OPISI_STRANICA.find((stranica) => stranica.kljuc === pageKey);
}

/**
 * Zone u koje sme tip koji čita katalog.
 *
 * Sve osim `prefooter`: ta zona stoji na svakoj stranici prodavnice, pa bi blok
 * proizvoda tamo značio upit ka bazi na svakom pogotku, na serveru koji deli
 * mašinu sa još tri aplikacije.
 */
const STRANICE_BEZ_PREFOOTERA = STRANICE.filter(
  (kljuc) => kljuc !== "prefooter",
) as readonly KljucStranice[];

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
  /** Kostur dok se čeka; ime obrađuje renderer. Asinhron tip ga uvek ima. */
  kostur?: "mrezaProizvoda" | "mrezaKartica" | "tekstualni";
  /** Tvrdo ograničenje broja sekcija ovog tipa po stranici. */
  maxPoStrani?: number;
  /**
   * Ime prekidača iz `storeCapabilities` bez kog tip nema šta da radi.
   *
   * Kad je prekidač ugašen, admin obrazac tip prikazuje kao ONEMOGUĆEN izbor sa
   * objašnjenjem, a ruta odbija njegovo dodavanje. Ranije je takva sekcija
   * jednostavno nestajala sa sajta bez ijedne poruke, pa se izgledalo kao kvar.
   */
  capability?: "newsletter" | "reviews" | "chat";
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
    "Jedan repeater za šest WoodMart elemenata: traka vrednosti, kartice sa " +
    "ikonom, numerisani koraci, harmonika sa pitanjima, vremenska linija i " +
    "brojači.",
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
        { vrednost: "harmonika", natpis: "Harmonika — pitanja i odgovori" },
        { vrednost: "linija", natpis: "Vremenska linija" },
        { vrednost: "brojaci", natpis: "Brojači" },
      ],
    },
    {
      kljuc: "izvor",
      natpis: "Odakle stavke",
      opis:
        "„Iz pitanja i odgovora” čita isti spisak koji puni chat. Radi samo uz " +
        "prikaz „harmonika”.",
      tip: "izbor",
      opcije: [
        { vrednost: "rucno", natpis: "Ručno upisane ispod" },
        { vrednost: "faq", natpis: "Iz pitanja i odgovora (chat)" },
      ],
    },
    {
      kljuc: "faqKategorija",
      natpis: "Kategorija pitanja",
      opis:
        "Obavezna uz izvor „iz pitanja i odgovora”. Bez nje bi svako pitanje " +
        "napisano za chat odmah osvanulo i na stranici.",
      tip: "tekst",
      maxDuzina: 64,
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
          opis:
            "Za prikaz „koraci“ — na primer 01. Za prikaz „brojači“ ovde ide " +
            "sam broj, na primer „120+“. Prazno znači bez oznake.",
          tip: "tekst",
          maxDuzina: 12,
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
    izvor: IZVORI_STAVKI[0],
    faqKategorija: "",
    kolone: "4",
    stavke: [],
  },
  stranice: STRANICE,
  /**
   * Izvor `faq` čita bazu. Zastavica je statična po tipu, pa stoji `true` i za
   * ručne stavke: `Suspense` sa praznim rezervnim sadržajem oko komponente koja
   * se odmah razreši ne menja ništa na ekranu, a bez njega bi FAQ varijanta
   * serijalizovala ostatak stranice.
   */
  asinhrona: true,
  kostur: "tekstualni",
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
  stranice: STRANICE_BEZ_PREFOOTERA,
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
  stranice: STRANICE_BEZ_PREFOOTERA,
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
 * Faza 5 — jeftini tipovi nad postojećim podacima
 * ------------------------------------------------------------------ */

/**
 * Tabela je ZASEBAN tip, a ne prikaz unutar `stavke`.
 *
 * Stavka repeatera ne može da nosi redove puta kolone sa zaglavljem: broj
 * ćelija zavisi od broja kolona, a repeater ima ravnu listu polja. Zato tabela
 * ima svoj `kind`, sa zaglavljem kao zasebnom listom.
 *
 * Podatak je strukturiran, a ne HTML: bogat tekst bi ovde propustio `<table>`
 * kroz belu listu koja ga namerno ne dozvoljava.
 */
const TABELA: TipSekcije = {
  kind: "tabela",
  naziv: "Tabela",
  opis:
    "Zaglavlje i redovi kao podatak, ne kao HTML. Do pet kolona; broj kolona " +
    "određuje zaglavlje.",
  grupa: "sadrzaj",
  faza: 5,
  polja: [
    {
      kljuc: "zaglavlje",
      natpis: "Zaglavlje",
      opis: "Svaka stavka je jedna kolona. Koliko ih ovde ima, toliko tabela ima kolona.",
      tip: "lista",
      maxStavki: 5,
      natpisStavke: "Kolona",
      stavka: [
        { kljuc: "naslov", natpis: "Naziv kolone", tip: "tekstLok", maxDuzina: 60, obavezno: true },
      ],
    },
    {
      kljuc: "redovi",
      natpis: "Redovi",
      tip: "lista",
      maxStavki: 20,
      natpisStavke: "Red",
      stavka: [
        { kljuc: "c1", natpis: "1. kolona", tip: "tekstLok", maxDuzina: 160 },
        { kljuc: "c2", natpis: "2. kolona", tip: "tekstLok", maxDuzina: 160 },
        { kljuc: "c3", natpis: "3. kolona", tip: "tekstLok", maxDuzina: 160 },
        { kljuc: "c4", natpis: "4. kolona", tip: "tekstLok", maxDuzina: 160 },
        { kljuc: "c5", natpis: "5. kolona", tip: "tekstLok", maxDuzina: 160 },
      ],
    },
    {
      kljuc: "prvaKolonaZaglavlje",
      natpis: "Prva kolona je zaglavlje reda",
      opis:
        "Uključi kad prva kolona imenuje red (na primer veličinu). Čitač ekrana " +
        "tada svaku ćeliju pročita zajedno sa nazivom reda.",
      tip: "prekidac",
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    zaglavlje: [],
    redovi: [],
    prvaKolonaZaglavlje: true,
  },
  stranice: STRANICE,
  asinhrona: false,
};

/**
 * Cenovnik je ZASEBAN tip iz istog razloga kao tabela: stavka nosi cenu,
 * valutu, sufiks, spisak osobina, oznaku „istaknuto“ i dugme — šest polja koja
 * u `stavke` ne pripadaju nijednom drugom prikazu.
 *
 * Osobine su višelinijski tekst, jedna po redu, a NE ugnežđena lista: admin
 * obrazac ne ume da ugnezdi repeater u repeater i namerno ga ne ume, jer takav
 * obrazac postaje neupotrebljiv na ekranu.
 */
const CENOVNIK: TipSekcije = {
  kind: "cenovnik",
  naziv: "Cenovnik",
  opis: "Uporedni paketi sa cenom, spiskom osobina i dugmetom.",
  grupa: "sadrzaj",
  faza: 5,
  polja: [
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
    {
      kljuc: "paketi",
      natpis: "Paketi",
      tip: "lista",
      maxStavki: 4,
      natpisStavke: "Paket",
      stavka: [
        { kljuc: "naziv", natpis: "Naziv", tip: "tekstLok", maxDuzina: 60, obavezno: true },
        { kljuc: "opis", natpis: "Kratak opis", tip: "tekstLok", maxDuzina: 160 },
        { kljuc: "cena", natpis: "Cena", tip: "tekst", maxDuzina: 24 },
        { kljuc: "valuta", natpis: "Valuta", tip: "tekst", maxDuzina: 8 },
        {
          kljuc: "sufiks",
          natpis: "Sufiks",
          opis: "Na primer „po komadu“ ili „mesečno“.",
          tip: "tekstLok",
          maxDuzina: 40,
        },
        {
          kljuc: "osobine",
          natpis: "Osobine",
          opis: "Jedna po redu. Prazan red se preskače.",
          tip: "viselinijskiLok",
          maxDuzina: 600,
        },
        { kljuc: "istaknuto", natpis: "Istaknut paket", tip: "prekidac" },
        { kljuc: "natpisDugmeta", natpis: "Natpis dugmeta", tip: "tekstLok", maxDuzina: 40 },
        { kljuc: "veza", natpis: "Dugme vodi na", tip: "veza" },
      ],
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    kolone: "3",
    paketi: [],
  },
  stranice: STRANICE,
  asinhrona: false,
};

const CLANCI: TipSekcije = {
  kind: "clanci",
  naziv: "Članci sa bloga",
  opis: "Najnoviji objavljeni članci iz modela Article.",
  grupa: "katalog",
  faza: 5,
  polja: [
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
    { kljuc: "broj", natpis: "Najviše članaka", tip: "broj", min: 1, max: 12, korak: 1 },
    { kljuc: "sazetak", natpis: "Prikaži sažetak", tip: "prekidac" },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    kolone: "3",
    broj: 3,
    sazetak: true,
  },
  stranice: STRANICE_BEZ_PREFOOTERA,
  asinhrona: true,
  kostur: "mrezaKartica",
};

/**
 * Odbrojavanje do isteka akcije.
 *
 * Izvor `akcija` uzima aktivnu promociju koja prva ističe. Nema biranja
 * konkretne promocije zato što javna ruta koja bi ih izlistala ne postoji, a
 * nova admin ruta samo zbog padajuće liste otvara površinu koju bi trebalo i
 * čuvati. Izvor `datum` postoji za sve što nije vezano za `Promotion`.
 */
const ODBROJAVANJE: TipSekcije = {
  kind: "odbrojavanje",
  naziv: "Odbrojavanje",
  opis: "Vreme do isteka akcije ili do unetog trenutka.",
  grupa: "katalog",
  faza: 5,
  polja: [
    {
      kljuc: "izvor",
      natpis: "Do čega se broji",
      tip: "izbor",
      opcije: [
        { vrednost: "akcija", natpis: "Do isteka akcije koja prva ističe" },
        { vrednost: "datum", natpis: "Do unetog trenutka" },
      ],
    },
    {
      kljuc: "datum",
      natpis: "Trenutak",
      opis: "Tumači se u vremenskoj zoni servera, ne u UTC-u.",
      tip: "datum",
    },
    POLJE_DUGMADI,
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    izvor: "akcija",
    datum: "",
    dugmad: [],
  },
  stranice: STRANICE_BEZ_PREFOOTERA,
  asinhrona: true,
  kostur: "tekstualni",
};

/**
 * Pokretna traka nad postojećim `@keyframes marquee` iz `app/globals.css`.
 *
 * Dugme za pauzu NIJE opcija. Kretanje traje duže od pet sekundi, pa WCAG 2.2.2
 * traži vidljiv mehanizam za zaustavljanje. „Pauza na hover“ ga ne ispunjava:
 * na dodirnom ekranu hover ne postoji, a tastatura ga ne pokreće.
 */
const TRAKA: TipSekcije = {
  kind: "traka",
  naziv: "Pokretna traka",
  opis: "Tekst koji klizi, sa obaveznim dugmetom za pauzu.",
  grupa: "sadrzaj",
  faza: 5,
  polja: [
    {
      kljuc: "stavke",
      natpis: "Reči u traci",
      tip: "lista",
      maxStavki: 12,
      natpisStavke: "Reč",
      stavka: [
        { kljuc: "tekst", natpis: "Tekst", tip: "tekstLok", maxDuzina: 60, obavezno: true },
      ],
    },
    {
      kljuc: "brzina",
      natpis: "Trajanje jednog kruga (sekundi)",
      tip: "broj",
      min: 10,
      max: 120,
      korak: 5,
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "uzak",
    stavke: [],
    brzina: 30,
  },
  stranice: STRANICE,
  asinhrona: false,
};

const UTISCI: TipSekcije = {
  kind: "utisci",
  naziv: "Utisci kupaca",
  opis:
    "Stvarne recenzije proizvoda, sa ocenom i imenom kupca. Ne piše se ručno — " +
    "izmišljen utisak je neistinit sadržaj.",
  grupa: "katalog",
  faza: 5,
  polja: [
    { kljuc: "kolone", natpis: "Kolona u redu", tip: "izbor", opcije: KOLONE },
    { kljuc: "broj", natpis: "Najviše utisaka", tip: "broj", min: 1, max: 12, korak: 1 },
    {
      kljuc: "najmanjaOcena",
      natpis: "Najmanja ocena",
      opis: "Utisci sa nižom ocenom se ne prikazuju.",
      tip: "broj",
      min: 1,
      max: 5,
      korak: 1,
    },
    {
      kljuc: "samoSaKomentarom",
      natpis: "Samo utisci sa komentarom",
      opis: "Gola ocena bez teksta nema šta da kaže posetiocu.",
      tip: "prekidac",
    },
  ],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "srednji",
    kolone: "3",
    broj: 3,
    najmanjaOcena: 4,
    samoSaKomentarom: true,
  },
  stranice: STRANICE_BEZ_PREFOOTERA,
  asinhrona: true,
  kostur: "mrezaKartica",
  capability: "reviews",
};

const NEWSLETTER: TipSekcije = {
  kind: "newsletter",
  naziv: "Prijava na novosti",
  opis: "Postojeći obrazac za prijavu, sada kao sekcija koja se pomera i gasi.",
  grupa: "sadrzaj",
  faza: 5,
  polja: [],
  podrazumevano: {
    ...PODRAZUMEVAN_OKVIR,
    razmak: "bez",
  },
  stranice: STRANICE,
  asinhrona: false,
  maxPoStrani: 1,
  capability: "newsletter",
};

/* ------------------------------------------------------------------ *
 * Javni registar
 * ------------------------------------------------------------------ */

export const TIPOVI_SEKCIJA: TipSekcije[] = [
  NASLOV,
  HERO,
  STAVKE,
  TEKST,
  TABELA,
  CENOVNIK,
  TRAKA,
  ODBROJAVANJE,
  NEWSLETTER,
  TAKSONOMIJA,
  PROIZVODI,
  CLANCI,
  UTISCI,
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

/**
 * Da li tip sme da se koristi uz date prekidače prodavnice.
 *
 * Prekidači se prosleđuju, a ne čitaju iz `storeCapabilities` ovde: registar
 * uvozi i admin obrazac u pregledaču, pa ne sme da zavisi od trenutka u kom se
 * `process.env` pročita, a ovako je pravilo i proverivo testom.
 */
/**
 * Da li tip sme na datu zonu.
 *
 * Nepoznat tip prolazi (o njemu odlučuje pozivalac), nepoznata zona ne prolazi:
 * sekcija upisana na `pageKey` koji nijedna stranica ne renderuje postoji u
 * bazi a nikad se ne vidi, i to bez ijedne poruke.
 */
export function tipDozvoljenNaStranici(kind: string, pageKey: string): boolean {
  if (!postojiStranica(pageKey)) return false;
  const tip = PO_KLJUCU.get(kind);
  if (!tip) return true;
  return (tip.stranice as readonly string[]).includes(pageKey);
}

export function tipJeDostupan(
  kind: string,
  prekidaci: Record<string, boolean>,
): boolean {
  const tip = PO_KLJUCU.get(kind);
  if (!tip || !tip.capability) return true;
  return prekidaci[tip.capability] === true;
}

/** Sveža kopija podrazumevane konfiguracije — nikad zajednička referenca. */
export function podrazumevanaKonfiguracija(kind: string): Record<string, unknown> {
  const tip = PO_KLJUCU.get(kind);
  if (!tip) return {};
  return structuredClone(tip.podrazumevano);
}

export type KonfiguracijaSekcije = Record<string, unknown> & Partial<VrednostiOkvira>;
