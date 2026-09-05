/**
 * Vezivanje rukovalaca medijateke za Prismu.
 *
 * Odvojeno od `medijateka-rute.ts` da taj modul ostane bez uvoza Prisme — inače
 * se njegovi testovi ne bi mogli pokrenuti pod `node --test`.
 */

import { prisma } from "@/lib/db";
import type { UpotrebaAsseta } from "./medijateka-rute";

export function prijaviNeuspehMedija(neuspeh: unknown): void {
  try {
    // Namerno grubo: samo metod i faza, nikad putanja, korisnik ni sesija.
    console.error("Zahtev nad medijatekom nije uspeo", neuspeh);
  } catch {
    // Beleženje nikad ne sme da zameni fail-closed odgovor.
  }
}

export async function nadjiUpotrebeAsseta(
  assetId: string,
): Promise<UpotrebaAsseta[]> {
  const redovi = await prisma.mediaAssetUsage.findMany({
    where: { assetId },
    select: {
      polje: true,
      section: { select: { id: true, pageKey: true, kind: true } },
    },
    take: 50,
  });

  return redovi.map((red) => ({
    sectionId: red.section.id,
    pageKey: red.section.pageKey,
    kind: red.section.kind,
    polje: red.polje,
  }));
}

/**
 * Briše samo red iz baze; fajl ostaje na disku.
 *
 * Odluka „da li DELETE briše i fajl, i ko čisti siročiće” je u
 * `docs/PLAN-SEKCIJE.md` navedena kao odluka vlasnika i još nije doneta. Do
 * tada se bira nepovratno manja šteta: zaostao fajl na disku zauzima prostor,
 * a obrisan fajl se ne vraća. Kad odluka bude doneta, brisanje mora ići kroz
 * `path.resolve` pa proveru prefiksa pre `unlink`, i u istoj transakciji.
 */
export async function obrisiAsset(assetId: string): Promise<number> {
  const obrisano = await prisma.mediaAsset.deleteMany({ where: { id: assetId } });
  return obrisano.count;
}
