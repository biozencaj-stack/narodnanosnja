/**
 * Upit bloka proizvoda: normalizacija vrednosti, ključ keša i plan upita.
 *
 * Modul je čist — nijedan poziv baze, nijedan uvoz React-a. Postoji zasebno iz
 * dva razloga. Prvi: `lib/products.ts` ima `"use server"` na prvoj liniji, pa
 * bi svaka pomoćna funkcija tamo postala javna Server Action, dostupna svakom
 * posetiocu preko POST zahteva. Drugi: `npm test` glob-uje isključivo
 * `lib/**\/*.test.ts`, pa se sve što se testira mora odvojiti od koda koji
 * odmah zove bazu.
 */

import type { Prisma } from "@prisma/client";
import {
  IZVORI_PROIZVODA,
  MAX_PROIZVODA_U_BLOKU,
  OBRAZAC_SLUGA,
  SORTIRANJA_PROIZVODA,
  jeObicanObjekat,
  type IzvorProizvoda,
  type SortProizvoda,
  type VrednostUpitaProizvoda,
} from "./polja";

/** Podrazumevani upit — isti koji registar upisuje u novu sekciju. */
export const PODRAZUMEVAN_UPIT: VrednostUpitaProizvoda = {
  izvor: "izdvojenoISnizeno",
  broj: 8,
  sort: "najnovije",
  kategorija: "",
  brend: "",
  izabrani: [],
};

/** Koje polje izbora koristi koji izvor. Sve ostalo se pri čitanju briše. */
const POLJE_IZVORA: Partial<Record<IzvorProizvoda, "kategorija" | "brend" | "izabrani">> = {
  kategorija: "kategorija",
  brend: "brend",
  izabrani: "izabrani",
};

function tekstIliPrazno(vrednost: unknown): string {
  return typeof vrednost === "string" && OBRAZAC_SLUGA.test(vrednost) ? vrednost : "";
}

function slugovi(vrednost: unknown): string[] {
  if (!Array.isArray(vrednost)) return [];
  const jedinstveni: string[] = [];
  for (const stavka of vrednost) {
    const slug = tekstIliPrazno(stavka);
    if (slug.length > 0 && !jedinstveni.includes(slug)) jedinstveni.push(slug);
  }
  return jedinstveni.slice(0, MAX_PROIZVODA_U_BLOKU);
}

/**
 * Čita zapisanu vrednost u oblik na koji se render može osloniti.
 *
 * Nikad ne baca: red je mogao biti upisan starijom šemom, pa svako polje pada
 * na podrazumevano ponaosob. Polja koja izabrani izvor ne koristi se brišu, da
 * dva bloka sa istim stvarnim upitom dele isti ključ keša.
 */
export function normalizujUpit(sirovo: unknown): VrednostUpitaProizvoda {
  const izvorno = jeObicanObjekat(sirovo) ? sirovo : {};

  const izvor = (IZVORI_PROIZVODA as readonly string[]).includes(
    izvorno.izvor as string,
  )
    ? (izvorno.izvor as IzvorProizvoda)
    : PODRAZUMEVAN_UPIT.izvor;

  const sort = (SORTIRANJA_PROIZVODA as readonly string[]).includes(
    izvorno.sort as string,
  )
    ? (izvorno.sort as SortProizvoda)
    : PODRAZUMEVAN_UPIT.sort;

  const sirovBroj = izvorno.broj;
  const broj =
    typeof sirovBroj === "number" && Number.isFinite(sirovBroj)
      ? Math.min(Math.max(Math.trunc(sirovBroj), 1), MAX_PROIZVODA_U_BLOKU)
      : PODRAZUMEVAN_UPIT.broj;

  const koriscenoPolje = POLJE_IZVORA[izvor];
  return {
    izvor,
    broj,
    sort,
    kategorija: koriscenoPolje === "kategorija" ? tekstIliPrazno(izvorno.kategorija) : "",
    brend: koriscenoPolje === "brend" ? tekstIliPrazno(izvorno.brend) : "",
    izabrani: koriscenoPolje === "izabrani" ? slugovi(izvorno.izabrani) : [],
  };
}

/**
 * Stabilan ključ jednog upita.
 *
 * React `cache()` pamti po identitetu argumenata, pa dva bloka sa jednakim ali
 * različitim objektima ne bi delila rezultat. Zato se upit svodi na string sa
 * fiksnim redosledom polja i keširana funkcija prima taj string.
 */
export function kljucUpita(upit: VrednostUpitaProizvoda): string {
  return JSON.stringify([
    upit.izvor,
    upit.broj,
    upit.sort,
    upit.kategorija,
    upit.brend,
    upit.izabrani,
  ]);
}

/** Vraća upit iz ključa. Neispravan ključ daje podrazumevani upit, ne izuzetak. */
export function upitIzKljuca(kljuc: string): VrednostUpitaProizvoda {
  let razlozeno: unknown;
  try {
    razlozeno = JSON.parse(kljuc);
  } catch {
    return { ...PODRAZUMEVAN_UPIT };
  }
  if (!Array.isArray(razlozeno)) return { ...PODRAZUMEVAN_UPIT };
  const [izvor, broj, sort, kategorija, brend, izabrani] = razlozeno;
  return normalizujUpit({ izvor, broj, sort, kategorija, brend, izabrani });
}

/* ------------------------------------------------------------------ *
 * Plan upita
 * ------------------------------------------------------------------ */

export interface KorakUpita {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput;
  take: number;
}

function poredak(sort: SortProizvoda): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "cenaRastuce":
      return { price: "asc" };
    case "cenaOpadajuce":
      return { price: "desc" };
    case "najnovije":
    default:
      return { createdAt: "desc" };
  }
}

/**
 * Plan izvršenja jednog bloka.
 *
 * Skoro svaki izvor je jedan korak. `izdvojenoISnizeno` su dva: zatečena
 * početna je prikazivala izdvojene pa sniženih koliko stane, a jedan `OR` upit
 * bi ih izmešao po datumu i promenio ono što je stranica godinama prikazivala.
 *
 * Prazan plan znači „izvor je izabran ali nije dopunjen“ — na primer izvor
 * `kategorija` bez izabrane kategorije. Blok tada ne renderuje ništa, umesto da
 * bez filtera prikaže ceo katalog.
 */
export function planUpita(upit: VrednostUpitaProizvoda): KorakUpita[] {
  const orderBy = poredak(upit.sort);
  const take = upit.broj;
  const osnova: Prisma.ProductWhereInput = { active: true };

  switch (upit.izvor) {
    case "izdvojeno":
      return [{ where: { ...osnova, featured: true }, orderBy, take }];

    case "snizeno":
      return [{ where: { ...osnova, onSale: true }, orderBy, take }];

    case "novo":
      return [{ where: { ...osnova, novo: true }, orderBy, take }];

    case "najnovije":
      return [{ where: osnova, orderBy, take }];

    case "izdvojenoISnizeno":
      return [
        { where: { ...osnova, featured: true }, orderBy, take },
        { where: { ...osnova, onSale: true }, orderBy, take },
      ];

    case "kategorija": {
      if (upit.kategorija.length === 0) return [];
      // Proizvod pripada kategoriji ili direktno, ili preko `ProductCategory`
      // veze koju admin koristi za višestruko svrstavanje. Oba puta se moraju
      // uzeti, inače blok tiho izostavi deo asortimana.
      return [
        {
          where: {
            ...osnova,
            OR: [
              { category: { slug: upit.kategorija } },
              { categories: { some: { category: { slug: upit.kategorija } } } },
            ],
          },
          orderBy,
          take,
        },
      ];
    }

    case "brend": {
      if (upit.brend.length === 0) return [];
      return [{ where: { ...osnova, brand: { slug: upit.brend } }, orderBy, take }];
    }

    case "izabrani": {
      if (upit.izabrani.length === 0) return [];
      // `take` je broj slugova, ne `broj`: ručni izbor je već konačna lista.
      return [
        {
          where: { ...osnova, slug: { in: upit.izabrani } },
          orderBy,
          take: upit.izabrani.length,
        },
      ];
    }
  }
}

/**
 * Redosled ručnog izbora je redosled koji je admin postavio, a ne onaj koji
 * baza vrati. Proizvod koji je u međuvremenu ugašen ili obrisan jednostavno
 * izostane.
 */
export function poredjajPoIzboru<T extends { slug: string }>(
  stavke: T[],
  redosled: string[],
): T[] {
  const poSlugu = new Map(stavke.map((stavka) => [stavka.slug, stavka]));
  const rezultat: T[] = [];
  for (const slug of redosled) {
    const stavka = poSlugu.get(slug);
    if (stavka) rezultat.push(stavka);
  }
  return rezultat;
}
