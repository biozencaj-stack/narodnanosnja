import { cache } from "react";
import { prisma } from "./index";

/**
 * Kartice taksonomije — kategorije i brendovi za istoimenu sekciju.
 *
 * Zasebno od `getNavCategories`: navigacija ne čita `image`, a kartica bez
 * slike je pola kartice. Zasebno i od `lib/products.ts`, iz istog razloga kao
 * `blok-proizvoda.ts` — taj fajl je `"use server"`.
 */

export interface KarticaTaksonomije {
  id: string;
  naziv: unknown;
  slug: string;
  /** Putanja slike iz medijateke, ili `null` kad je admin nije postavio. */
  slika: string | null;
  veza: string;
  /** Podkategorije; kod brendova uvek prazno, jer brend nema podelu. */
  podstavke: { id: string; naziv: unknown; veza: string }[];
}

/**
 * Kategorije označene za navigaciju. Isti spisak koji admin već održava — nema
 * drugog mesta na kom bi se odlučivalo šta se vidi na početnoj.
 */
export const ucitajKarticeKategorija = cache(
  async (): Promise<KarticaTaksonomije[]> => {
    const redovi = await prisma.category.findMany({
      where: { active: true, showInNav: true, parentId: null },
      orderBy: { navOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        children: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, slug: true },
        },
      },
    });
    return redovi.map((red) => ({
      id: red.id,
      naziv: red.name,
      slug: red.slug,
      slika: red.image,
      veza: `/category/${red.slug}`,
      podstavke: red.children.map((dete) => ({
        id: dete.id,
        naziv: dete.name,
        // Podkategorija se otvara kroz istu `[...slug]` rutu, sa dva segmenta.
        veza: `/category/${red.slug}/${dete.slug}`,
      })),
    }));
  },
);

/**
 * Aktivni brendovi. Brend bez ijednog aktivnog proizvoda se izostavlja — inače
 * kartica vodi na praznu stranicu, što je gore od odsutne kartice.
 */
export const ucitajKarticeBrendova = cache(
  async (): Promise<KarticaTaksonomije[]> => {
    const redovi = await prisma.brand.findMany({
      where: { active: true, products: { some: { active: true } } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, logo: true },
    });
    return redovi.map((red) => ({
      id: red.id,
      naziv: red.name,
      slug: red.slug,
      slika: red.logo,
      veza: `/catalog/brand/${red.slug}`,
      podstavke: [],
    }));
  },
);
