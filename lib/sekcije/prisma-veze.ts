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
import { medijiUKonfiguraciji } from "./mediji-u-konfiguraciji";
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

  if (!podaci.nacrt) {
    // Objavljeno stanje i upotrebe medija moraju se promeniti zajedno.
    // Odvojeni upisi bi ostavili trenutak u kome slika više nije na stranici a
    // i dalje se broji kao upotrebljena, ili obrnuto — a baš na osnovu tog
    // broja se odlučuje sme li se obrisati.
    return prisma.$transaction(async (tx) => {
      const izmena = await tx.pageSection.updateMany({
        where: { id: podaci.id, version: podaci.verzija },
        data: {
          config: podaci.config as Prisma.InputJsonObject,
          ...(podaci.vidljiva === undefined
            ? {}
            : { isActive: podaci.vidljiva }),
          draftConfig: Prisma.DbNull,
          draftIsActive: null,
          publishedAt: new Date(),
          version: { increment: 1 },
          updatedById: podaci.korisnikId,
        },
      });

      if (izmena.count === 0) return 0;

      const sekcija = await tx.pageSection.findUnique({
        where: { id: podaci.id },
        select: { kind: true },
      });
      if (sekcija) {
        await uskladiUpotrebeMedija(
          tx,
          podaci.id,
          sekcija.kind,
          podaci.config,
        );
      }

      return izmena.count;
    });
  }

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
        kind: true,
        config: true,
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

      // Upotrebe se računaju iz konfiguracije koja je upravo POSTALA
      // objavljena: nacrt ako ga je bilo, inače zatečena.
      await uskladiUpotrebeMedija(
        tx,
        sekcija.id,
        sekcija.kind,
        sekcija.draftConfig ?? sekcija.config,
      );

      promenjeno += 1;
    }

    return promenjeno;
  });
}

/**
 * Usklađuje `MediaAssetUsage` sa sadržajem OBJAVLJENE konfiguracije sekcije.
 *
 * Prati se objavljeno stanje, ne nacrt. Da se prati nacrt, slika izbačena u
 * nacrtu odmah bi postala „neupotrebljena“ i mogla bi da se obriše — dok je
 * javni sajt i dalje prikazuje.
 *
 * Sve ide u jednoj transakciji sa upisom sekcije. Delimično usklađen spisak je
 * gori od neusklađenog: brisanje slike bi se odbijalo ili dozvoljavalo na
 * osnovu podataka koji ne opisuju nijedno stvarno stanje.
 *
 * Upotrebe koje pokazuju na putanju bez reda u `MediaAsset` se preskaču. To
 * nije greška nego zatečeno stanje: slike otpremljene pre medijateke postoje na
 * disku, a nemaju red u bazi.
 */
export async function uskladiUpotrebeMedija(
  tx: Prisma.TransactionClient,
  sekcijaId: string,
  kind: string,
  objavljenaKonfiguracija: unknown,
): Promise<void> {
  const zeljene = medijiUKonfiguraciji(kind, objavljenaKonfiguracija);

  await tx.mediaAssetUsage.deleteMany({ where: { sectionId: sekcijaId } });
  if (zeljene.length === 0) return;

  const assets = await tx.mediaAsset.findMany({
    where: { path: { in: zeljene.map((u) => u.putanja) } },
    select: { id: true, path: true },
  });
  const poPutanji = new Map(assets.map((a) => [a.path, a.id]));

  const redovi = zeljene
    .map((upotreba) => {
      const assetId = poPutanji.get(upotreba.putanja);
      return assetId
        ? { assetId, sectionId: sekcijaId, polje: upotreba.polje }
        : null;
    })
    .filter((red): red is NonNullable<typeof red> => red !== null);

  if (redovi.length > 0) {
    await tx.mediaAssetUsage.createMany({ data: redovi });
  }
}
