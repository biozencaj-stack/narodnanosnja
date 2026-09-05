/**
 * Tipizovano čitanje konfiguracije u prezentacionom sloju.
 *
 * Renderer već provuče svaku sekciju kroz `normalizujSekciju`, pa su vrednosti
 * ovde ispravnog oblika. Ovi čitači postoje da komponente ne rade `as any` i da
 * red upisan starijom verzijom šeme i dalje renderuje: svaki čitač ima jasno
 * ponašanje kad vrednosti nema.
 */

import {
  type Lokalizovano,
  type TokenPozadine,
  type TokenUkrasa,
  citajLok,
  jeObicanObjekat,
} from "@/lib/sekcije/polja";
import {
  PODRAZUMEVAN_OKVIR,
  type Animacija,
  type NivoNaslova,
  type Poravnanje,
  type Razdelnik,
  type Razmak,
  type Sara,
} from "@/lib/sekcije/okvir";

export type Konfiguracija = Record<string, unknown>;

export interface KonfiguracijaOkvira {
  nadnaslov: Lokalizovano;
  naslov: Lokalizovano;
  istaknutaRec: string;
  tekst: Lokalizovano;
  poravnanje: Poravnanje;
  nivoNaslova: NivoNaslova;
  pozadina: TokenPozadine;
  sara: Sara;
  saraVelicina: number;
  saraProzirnost: number;
  saraBoja: TokenUkrasa;
  saraBojaDruga: TokenUkrasa;
  razdelnikGore: Razdelnik;
  razdelnikDole: Razdelnik;
  razdelnikVisina: number;
  razdelnikBoja: TokenUkrasa;
  razdelnikBojaDruga: TokenUkrasa;
  razmak: Razmak;
  animacija: Animacija;
  sidro: string;
}

function tekstIli(vrednost: unknown, rezerva: string): string {
  return typeof vrednost === "string" ? vrednost : rezerva;
}

function brojIli(vrednost: unknown, rezerva: number): number {
  return typeof vrednost === "number" && Number.isFinite(vrednost) ? vrednost : rezerva;
}

function lokIli(vrednost: unknown, rezerva: Lokalizovano): Lokalizovano {
  if (typeof vrednost === "string") return { sr: vrednost, en: vrednost };
  if (!jeObicanObjekat(vrednost)) return rezerva;
  const sr = typeof vrednost.sr === "string" ? vrednost.sr : rezerva.sr;
  const en = typeof vrednost.en === "string" ? vrednost.en : sr;
  return { sr, en };
}

/** Vrednosti okvira, sa padom na podrazumevano za svako polje ponaosob. */
export function citajOkvir(config: Konfiguracija): KonfiguracijaOkvira {
  const p = PODRAZUMEVAN_OKVIR;
  return {
    nadnaslov: lokIli(config.nadnaslov, p.nadnaslov),
    naslov: lokIli(config.naslov, p.naslov),
    istaknutaRec: tekstIli(config.istaknutaRec, p.istaknutaRec),
    tekst: lokIli(config.tekst, p.tekst),
    poravnanje: tekstIli(config.poravnanje, p.poravnanje) as Poravnanje,
    nivoNaslova: tekstIli(config.nivoNaslova, p.nivoNaslova) as NivoNaslova,
    pozadina: tekstIli(config.pozadina, p.pozadina) as TokenPozadine,
    sara: tekstIli(config.sara, p.sara) as Sara,
    saraVelicina: brojIli(config.saraVelicina, p.saraVelicina),
    saraProzirnost: brojIli(config.saraProzirnost, p.saraProzirnost),
    saraBoja: tekstIli(config.saraBoja, p.saraBoja) as TokenUkrasa,
    saraBojaDruga: tekstIli(config.saraBojaDruga, p.saraBojaDruga) as TokenUkrasa,
    razdelnikGore: tekstIli(config.razdelnikGore, p.razdelnikGore) as Razdelnik,
    razdelnikDole: tekstIli(config.razdelnikDole, p.razdelnikDole) as Razdelnik,
    razdelnikVisina: brojIli(config.razdelnikVisina, p.razdelnikVisina),
    razdelnikBoja: tekstIli(config.razdelnikBoja, p.razdelnikBoja) as TokenUkrasa,
    razdelnikBojaDruga: tekstIli(
      config.razdelnikBojaDruga,
      p.razdelnikBojaDruga,
    ) as TokenUkrasa,
    razmak: tekstIli(config.razmak, p.razmak) as Razmak,
    animacija: tekstIli(config.animacija, p.animacija) as Animacija,
    sidro: tekstIli(config.sidro, p.sidro),
  };
}

/** Lokalizovan tekst iz konfiguracije, već pao na srpski ako engleskog nema. */
export function tekstPolja(
  config: Konfiguracija,
  kljuc: string,
  jezik: string,
): string {
  return citajLok(config[kljuc], jezik);
}

/** Stavke repeatera. Sve što nije objekat se preskače, ne ruši render. */
export function stavkeListe(config: Konfiguracija, kljuc: string): Konfiguracija[] {
  const vrednost = config[kljuc];
  if (!Array.isArray(vrednost)) return [];
  return vrednost.filter(jeObicanObjekat);
}

export interface Veza {
  url: string;
  noviTab: boolean;
}

/**
 * Veza je već proverena validatorom pri upisu. Ovde se ponovo proverava samo
 * oblik, jer red može doći i iz starijeg zapisa; nepoznat oblik znači da se
 * dugme ne renderuje, umesto da vodi u prazno.
 */
export function veza(vrednost: unknown): Veza | null {
  if (!jeObicanObjekat(vrednost)) return null;
  const url = vrednost.url;
  if (typeof url !== "string" || url.length === 0) return null;
  return { url, noviTab: vrednost.noviTab === true };
}

export function izbor<T extends string>(
  config: Konfiguracija,
  kljuc: string,
  dozvoljene: readonly T[],
  rezerva: T,
): T {
  const vrednost = config[kljuc];
  return typeof vrednost === "string" && (dozvoljene as readonly string[]).includes(vrednost)
    ? (vrednost as T)
    : rezerva;
}

export function broj(config: Konfiguracija, kljuc: string, rezerva: number): number {
  return brojIli(config[kljuc], rezerva);
}
