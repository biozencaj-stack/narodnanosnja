import { unstable_cache } from "next/cache";
import { prisma } from "./index";
import { oznakaStranice } from "@/lib/sekcije/invalidacija";
import { OBRAZAC_KLJUCA_STRANICE } from "@/lib/sekcije/polja";

export interface ObjavljenaSekcija {
  id: string;
  kind: string;
  config: unknown;
}

/**
 * Sekcije koje javni sajt sme da prikaže.
 *
 * `select` NAMERNO ne navodi nijednu nacrt-kolonu. To nije mikro-optimizacija
 * nego granica: da su `draftConfig`, `draftOrder` i `draftIsActive` u rezultatu,
 * jedan pogrešan `??` u komponenti bi objavio neobjavljen sadržaj, a greška bi
 * se videla tek na produkciji. Ovako neobjavljena vrednost ne postoji u
 * objektu koji javni render uopšte dobija.
 *
 * `publishedAt: null` znači „nikad objavljeno” i takva sekcija se ne prikazuje
 * ni kad je `isActive`. Sekcija se tako može napraviti i pripremiti, a da se ne
 * pojavi na sajtu dok se ne pritisne „Objavi”.
 */
async function citajObjavljene(pageKey: string): Promise<ObjavljenaSekcija[]> {
  const redovi = await prisma.pageSection.findMany({
    where: {
      pageKey,
      isActive: true,
      publishedAt: { not: null },
    },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, kind: true, config: true },
  });

  return redovi.map((red) => ({
    id: red.id,
    kind: red.kind,
    config: red.config,
  }));
}

/**
 * Keširano čitanje objavljenog rasporeda.
 *
 * Ključ keša mora da sadrži `pageKey`, inače bi sve stranice delile jedan unos
 * i druga stranica bi dobila raspored prve. Oznaka je po stranici, pa objava
 * jedne ne ruši keš ostalih.
 */
export function citajObjavljeneSekcije(
  pageKey: string,
): Promise<ObjavljenaSekcija[]> {
  if (!OBRAZAC_KLJUCA_STRANICE.test(pageKey)) {
    throw new RangeError(`Neispravan ključ stranice: ${pageKey}`);
  }

  return unstable_cache(
    () => citajObjavljene(pageKey),
    ["sekcije", pageKey],
    { revalidate: 300, tags: [oznakaStranice(pageKey)] },
  )();
}

/**
 * Raspored za pregled nacrta: nacrt-vrednost kad postoji, inače objavljena.
 *
 * Nikad se ne kešira — pregled mora da pokaže poslednje stanje odmah posle
 * snimanja, a i namenjen je jednom administratoru, ne saobraćaju sa sajta.
 */
export async function citajNacrtSekcija(
  pageKey: string,
): Promise<ObjavljenaSekcija[]> {
  if (!OBRAZAC_KLJUCA_STRANICE.test(pageKey)) {
    throw new RangeError(`Neispravan ključ stranice: ${pageKey}`);
  }

  const redovi = await prisma.pageSection.findMany({
    where: { pageKey },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: {
      id: true,
      kind: true,
      config: true,
      isActive: true,
      order: true,
      draftConfig: true,
      draftOrder: true,
      draftIsActive: true,
    },
  });

  return redovi
    .map((red) => ({
      id: red.id,
      kind: red.kind,
      config: red.draftConfig ?? red.config,
      redosled: red.draftOrder ?? red.order,
      vidljiva: red.draftIsActive ?? red.isActive,
    }))
    .filter((red) => red.vidljiva)
    .sort((a, b) => a.redosled - b.redosled || a.id.localeCompare(b.id))
    .map(({ id, kind, config }) => ({ id, kind, config }));
}
