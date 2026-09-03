/**
 * Vezivanje rukovalaca sekcija za Prismu i Next keš.
 *
 * Stoji odvojeno od `rute.ts` da bi taj modul ostao bez uvoza Prisme i
 * `next/cache` — inače se njegovi testovi ne bi mogli pokrenuti pod
 * `node --test` bez podizanja celog Next runtime-a.
 */

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { oznakeZaInvalidaciju, type RazlogInvalidacije } from "./invalidacija";
import { SukobRedosleda, type RedSekcije, type StavkaRedosleda } from "./rute";

export function prijaviNeuspeh(neuspeh: unknown): void {
  try {
    // Namerno grubo: sadrži samo metod i fazu, nikad telo, korisnika ni sesiju.
    console.error("Zahtev nad sekcijama nije uspeo", neuspeh);
  } catch {
    // Beleženje nikad ne sme da zameni fail-closed odgovor.
  }
}

export async function ponistiKes(
  razlog: RazlogInvalidacije,
  pageKey: string,
): Promise<void> {
  for (const oznaka of oznakeZaInvalidaciju(razlog, pageKey)) {
    // Drugi argument je obavezan u Next 16; bez njega oznaka istekne tek po
    // isteku `revalidate`, pa bi objava delovala kao da nije radila.
    revalidateTag(oznaka, { expire: 0 });
  }
}

export function nadjiSekciju(id: string): Promise<RedSekcije | null> {
  return prisma.pageSection.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      pageKey: true,
      version: true,
      publishedAt: true,
    },
  });
}

export async function izmeniUslovno(podaci: {
  id: string;
  verzija: number;
  config: Record<string, unknown>;
  vidljiva: boolean | undefined;
  nacrt: boolean;
  korisnikId: string;
}): Promise<number> {
  const zajednicko = {
    version: { increment: 1 },
    updatedById: podaci.korisnikId,
  };

  const izmena = await prisma.pageSection.updateMany({
    where: { id: podaci.id, version: podaci.verzija },
    data: podaci.nacrt
      ? {
          draftConfig: podaci.config as Prisma.InputJsonObject,
          ...(podaci.vidljiva === undefined
            ? {}
            : { draftIsActive: podaci.vidljiva }),
          ...zajednicko,
        }
      : {
          config: podaci.config as Prisma.InputJsonObject,
          ...(podaci.vidljiva === undefined
            ? {}
            : { isActive: podaci.vidljiva }),
          // `Prisma.DbNull`, ne `null`: kod nullable Json kolone `null` znači
          // JSON vrednost `null`, a treba nam SQL NULL — jedini oblik koji
          // `draftConfig ?? config` čita kao „nema nacrta”.
          draftConfig: Prisma.DbNull,
          draftIsActive: null,
          publishedAt: new Date(),
          ...zajednicko,
        },
  });

  return izmena.count;
}

export async function obrisiUslovno(
  id: string,
  verzija: number,
): Promise<number> {
  const obrisano = await prisma.pageSection.deleteMany({
    where: { id, version: verzija },
  });
  return obrisano.count;
}

export async function presloziUTransakciji(podaci: {
  pageKey: string;
  stavke: readonly StavkaRedosleda[];
  nacrt: boolean;
  korisnikId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const [redniBroj, stavka] of podaci.stavke.entries()) {
      const izmena = await tx.pageSection.updateMany({
        where: {
          id: stavka.id,
          pageKey: podaci.pageKey,
          version: stavka.version,
        },
        data: podaci.nacrt
          ? {
              draftOrder: redniBroj,
              version: { increment: 1 },
              updatedById: podaci.korisnikId,
            }
          : {
              order: redniBroj,
              draftOrder: null,
              version: { increment: 1 },
              updatedById: podaci.korisnikId,
            },
      });

      // Uslov hvata i pogrešnu verziju i sekciju koja pripada drugoj stranici.
      if (izmena.count === 0) throw new SukobRedosleda();
    }
  });
}

export function objaviStranicu(
  pageKey: string,
  korisnikId: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const sekcije = await tx.pageSection.findMany({
      where: { pageKey },
      select: {
        id: true,
        draftConfig: true,
        draftOrder: true,
        draftIsActive: true,
        publishedAt: true,
      },
    });

    const trenutak = new Date();
    let promenjeno = 0;

    for (const sekcija of sekcije) {
      const imaNacrt =
        sekcija.draftConfig !== null ||
        sekcija.draftOrder !== null ||
        sekcija.draftIsActive !== null;

      // Sekcija bez nacrta koja nikad nije objavljena svejedno mora dobiti
      // `publishedAt`, inače bi novonapravljena sekcija ostala nevidljiva i
      // posle pritiska na „Objavi”.
      if (!imaNacrt && sekcija.publishedAt !== null) continue;

      await tx.pageSection.update({
        where: { id: sekcija.id },
        data: {
          config:
            sekcija.draftConfig === null
              ? undefined
              : (sekcija.draftConfig as Prisma.InputJsonObject),
          order: sekcija.draftOrder ?? undefined,
          isActive: sekcija.draftIsActive ?? undefined,
          draftConfig: Prisma.DbNull,
          draftOrder: null,
          draftIsActive: null,
          publishedAt: trenutak,
          version: { increment: 1 },
          updatedById: korisnikId,
        },
      });
      promenjeno += 1;
    }

    return promenjeno;
  });
}
