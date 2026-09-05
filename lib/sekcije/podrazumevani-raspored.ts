/**
 * Raspored početne stranice, dok još ne postoji tabela `PageSection`.
 *
 * PRIVREMENO. Ovo je mreža za pad faze 1: raspored je podatak, ali još stoji u
 * kodu, pa se apstrakcija dokazuje bez ijedne izmene baze. Brisanje ovog fajla
 * je čekirana stavka faze 3 i uslovljeno je proverom NAD PRODUKCIJOM da
 * objavljene sekcije zaista postoje — ne grep-om nad repozitorijumom.
 *
 * Sav tekst je prepisan DOSLOVNO iz `components/home/nosnja.tsx`, koja je do
 * sada bila jedina živa početna. Ništa nije preuzeto iz nemontiranih šablonskih
 * komponenti: „Podrška 24/7“, „Besplatna dostava“, „30 dana za zamenu“ i četiri
 * izmišljena kupca su neistinit sadržaj i ne ulaze u podatke prodavnice.
 */

import { lok } from "./polja";
import { podrazumevanaKonfiguracija } from "./registar";

export interface SekcijaZaPrikaz {
  /** Stabilan ključ; posle faze 2 ovo je `PageSection.id`. */
  id: string;
  kind: string;
  config: Record<string, unknown>;
}

function sekcija(
  id: string,
  kind: string,
  izmene: Record<string, unknown>,
): SekcijaZaPrikaz {
  return { id, kind, config: { ...podrazumevanaKonfiguracija(kind), ...izmene } };
}

export const RASPORED_POCETNE: SekcijaZaPrikaz[] = [
  sekcija("home-hero", "hero", {
    pozadina: "podlogaAlt",
    sara: "romb",
    saraVelicina: 64,
    saraProzirnost: 0.055,
    saraBoja: "primarnaTamna",
    saraBojaDruga: "zlatna",
    razmak: "uvodni",
    razdelnikDole: "traka",
    razdelnikVisina: 20,
    razdelnikBoja: "zlatna",
    razdelnikBojaDruga: "primarna",
    nivoNaslova: "h1",
    nadnaslov: lok("Ručni rad · tkano na razboju"),
    naslov: lok("Svaki komad\nje jedinstven"),
    istaknutaRec: "jedinstven",
    tekst: lok(
      "Šalovi, tkanice i torbe tkane na razboju, po šarama koje se u ovim " +
        "krajevima pamte s kolena na koleno. Šara se ne prepisuje — pamti se. " +
        "Zato ne postoje dva ista komada.",
    ),
    prikaz: "mozaik",
    dugmad: [
      {
        natpis: lok("Pogledaj ponudu"),
        veza: { url: "/catalog", noviTab: false },
        stil: "puno",
      },
      {
        natpis: lok("Kako nastaje"),
        veza: { url: "#kako-nastaje", noviTab: false },
        stil: "obrub",
      },
    ],
    slike: [],
  }),

  sekcija("home-vrednosti", "stavke", {
    pozadina: "podloga",
    razmak: "uzak",
    razdelnikDole: "linija",
    prikaz: "traka",
    kolone: "4",
    stavke: [
      {
        naslov: lok("Rađeno rukom"),
        tekst: lok("Na razboju, bez mašinskog tkanja"),
        oznaka: "",
        motiv: 0,
      },
      {
        naslov: lok("Nema dva ista"),
        tekst: lok("Svaki komad se malo razlikuje"),
        oznaka: "",
        motiv: 1,
      },
      {
        naslov: lok("Plaćanje pouzećem"),
        tekst: lok("Platite kuriru pri preuzimanju"),
        oznaka: "",
        motiv: 2,
      },
      {
        naslov: lok("Isporuka u Srbiji"),
        tekst: lok("Za 2–4 radna dana"),
        oznaka: "",
        motiv: 3,
      },
    ],
  }),

  sekcija("home-kategorije", "taksonomija", {
    pozadina: "podloga",
    razmak: "srednji",
    naslov: lok("Šta se tka"),
    tekst: lok("Isti razboj, ista vuna — različita namena."),
    kolone: "3",
    broj: 24,
  }),

  sekcija("home-izdvojeno", "proizvodi", {
    pozadina: "podloga",
    razmak: "srednji",
    naslov: lok("Izdvojeno iz radionice"),
    tekst: lok("Komadi koje najčešće preporučujemo — i za sebe i za poklon."),
    upit: { izvor: "izdvojenoISnizeno", broj: 8 },
    kolone: "4",
  }),

  /**
   * Tkana traka koja je do sada stajala kao samostalan element između
   * proizvoda i priče o izradi. Ostaje sekcija sa osnovnom podlogom, jer je i
   * ranije stajala na boji tela stranice, ne na alternativnoj podlozi.
   */
  sekcija("home-traka", "naslov", {
    pozadina: "podloga",
    razmak: "bez",
    naslov: lok(""),
    razdelnikDole: "traka",
    razdelnikVisina: 20,
    razdelnikBoja: "zlatna",
    razdelnikBojaDruga: "primarna",
  }),

  sekcija("home-kako-nastaje", "stavke", {
    pozadina: "podlogaAlt",
    sara: "grana",
    saraVelicina: 40,
    saraProzirnost: 0.07,
    saraBoja: "primarnaTamna",
    saraBojaDruga: "zlatna",
    razmak: "srednji",
    sidro: "kako-nastaje",
    nadnaslov: lok("Iz radionice"),
    naslov: lok("Kako nastaje jedan komad"),
    tekst: lok(
      "Četiri koraka i nekoliko nedelja rada — zato cena nije kao u " +
        "prodavnici gotove robe.",
    ),
    prikaz: "koraci",
    kolone: "4",
    stavke: [
      {
        naslov: lok("Vuna i lan"),
        tekst: lok(
          "Vuna se pere, suši i grebena; lan se moči, trli i češlja dok ne " +
            "ostane samo mekano vlakno. Od njive do pređe prođe i po godinu dana.",
        ),
        oznaka: "01",
        motiv: 0,
      },
      {
        naslov: lok("Bojenje"),
        tekst: lok(
          "Prirodne boje — orahova ljuska, broć, kora divlje jabuke. Zato dve " +
            "serije iste šare nikad nisu potpuno isti ton.",
        ),
        oznaka: "02",
        motiv: 0,
      },
      {
        naslov: lok("Razboj"),
        tekst: lok(
          "Osnova se snuje danima, a šara se ne crta ni ne prepisuje — pamti se " +
            "napamet i provlači čunkom, red po red.",
        ),
        oznaka: "03",
        motiv: 0,
      },
      {
        naslov: lok("Rese i dorada"),
        tekst: lok(
          "Rese se uvrću rukom, rubovi se opšivaju. Tek tada komad dobija ime i " +
            "ide iz radionice.",
        ),
        oznaka: "04",
        motiv: 0,
      },
    ],
  }),

  sekcija("home-prica", "hero", {
    pozadina: "tamna",
    sara: "rozeta",
    saraVelicina: 56,
    saraProzirnost: 0.13,
    saraBoja: "zlatnaJaka",
    saraBojaDruga: "primarna",
    razmak: "visok",
    poravnanje: "centar",
    nivoNaslova: "h2",
    nadnaslov: lok("Odakle šare dolaze"),
    naslov: lok("Nošnja nije kostim"),
    istaknutaRec: "",
    tekst: lok(
      "Po kroju se znalo iz kog je sela čovek, po boji marame da li je žena " +
        "udata, po broju dukata koliko kuća stoji. Šare koje tkamo nisu ukras — " +
        "one su bile pismo.",
    ),
    prikaz: "centrirano",
    dugmad: [
      {
        natpis: lok("Pročitaj o krajevima"),
        veza: { url: "/blog", noviTab: false },
        stil: "obrubSvetli",
      },
    ],
    slike: [],
  }),
];

/** Raspored za datu stranicu. Dok postoji samo početna, ostalo je prazno. */
export function podrazumevanRaspored(pageKey: string): SekcijaZaPrikaz[] {
  return pageKey === "home" ? RASPORED_POCETNE : [];
}
