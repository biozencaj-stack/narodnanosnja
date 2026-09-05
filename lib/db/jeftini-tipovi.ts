import { cache } from "react";
import { prisma } from "./index";
import { sanitizeRichHtml } from "@/lib/security/html";

/**
 * Upiti za tipove sekcija iz faze 5.
 *
 * Namerno NIJE u `lib/products.ts` ni u `lib/promotions.ts`: oba imaju
 * `"use server"` na prvoj liniji, pa bi svaki nov izvoz postao javna Server
 * Action koju bilo ko sa interneta poziva POST zahtevom sa svojim argumentima.
 * `jeftini-tipovi.test.ts` čuva to pravilo.
 *
 * Svaki upit ide kroz React `cache()`, pa dve sekcije sa istim parametrima u
 * istom zahtevu naprave jedan upit ka bazi.
 */

/* ------------------------------------------------------------------ *
 * Pitanja i odgovori
 * ------------------------------------------------------------------ */

export interface PitanjeIOdgovor {
  id: string;
  pitanje: string;
  /** Već sanitizovan HTML. */
  odgovor: string;
}

/**
 * Pitanja jedne kategorije.
 *
 * Filter po kategoriji je OBAVEZAN argument, ne opcion: isti model puni i chat
 * widžet, pa bi bez filtera svako pitanje napisano za chat odmah osvanulo i na
 * stranici. Validator to isto pravilo drži i pri upisu sekcije.
 *
 * Odgovor prolazi kroz `sanitizeRichHtml` kao i u `/api/chat/faq` — isti zapis,
 * ista granica, bez obzira na to ko ga čita.
 */
export const ucitajPitanja = cache(
  async (kategorija: string, koliko: number): Promise<PitanjeIOdgovor[]> => {
    const ociscena = kategorija.trim();
    if (ociscena.length === 0) return [];

    const redovi = await prisma.chatFAQ.findMany({
      where: { active: true, category: ociscena },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: koliko,
      select: { id: true, question: true, answer: true },
    });

    return redovi.map((red) => ({
      id: red.id,
      pitanje: red.question,
      odgovor: sanitizeRichHtml(red.answer),
    }));
  },
);

/* ------------------------------------------------------------------ *
 * Članci
 * ------------------------------------------------------------------ */

export interface KarticaClanka {
  id: string;
  naslov: string;
  slug: string;
  sazetak: string | null;
  slika: string | null;
  objavljen: string | null;
}

/**
 * Najnoviji objavljeni članci.
 *
 * `Article.title` je obična `String` kolona, a ne `Json { sr, en }` kao kod
 * proizvoda i kategorija. Naslov članka zato NIJE lokalizovan i na engleskoj
 * verziji stranice stoji na srpskom. To je poznat nedostatak modela, ne
 * previd ovog tipa sekcije; ispravka traži migraciju kolone i ne krije se
 * ovde.
 */
export const ucitajClanke = cache(
  async (koliko: number): Promise<KarticaClanka[]> => {
    const redovi = await prisma.article.findMany({
      where: { published: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: koliko,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        image1: true,
        publishedAt: true,
      },
    });

    return redovi.map((red) => ({
      id: red.id,
      naslov: red.title,
      slug: red.slug,
      sazetak: red.excerpt,
      slika: red.image1,
      objavljen: red.publishedAt ? red.publishedAt.toISOString() : null,
    }));
  },
);

/* ------------------------------------------------------------------ *
 * Utisci
 * ------------------------------------------------------------------ */

export interface Utisak {
  id: string;
  ocena: number;
  naslov: string | null;
  komentar: string | null;
  potpis: string;
  verifikovan: boolean;
  proizvod: { slug: string; naziv: unknown } | null;
}

/** Ime i prvo slovo prezimena — pun identitet kupca nije za javnu stranicu. */
function potpisKupca(ime: string | null, prezime: string | null): string {
  const licno = (ime ?? "").trim();
  const porodicno = (prezime ?? "").trim();
  if (licno.length === 0) return "Kupac";
  return porodicno.length > 0 ? `${licno} ${porodicno[0]}.` : licno;
}

/**
 * Utisci iz stvarnih recenzija.
 *
 * Filter `productId: { not: null }` je OBAVEZAN: kolona je nullable, pa bi
 * recenzija vezana samo za ERP šifru ušla ovde bez ijednog proizvoda i kartica
 * bi vodila u prazno.
 *
 * `getProductReviewStats` se ne koristi — agregira po `productCode`, što NIJE
 * isti ključ i ne može se spojiti sa `Product.id`.
 */
export const ucitajUtiske = cache(
  async (
    koliko: number,
    najmanjaOcena: number,
    samoSaKomentarom: boolean,
  ): Promise<Utisak[]> => {
    const redovi = await prisma.productReview.findMany({
      where: {
        productId: { not: null },
        product: { active: true },
        rating: { gte: najmanjaOcena },
        ...(samoSaKomentarom ? { comment: { not: null } } : {}),
      },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: koliko,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        verified: true,
        user: { select: { firstName: true, lastName: true } },
        product: { select: { slug: true, name: true } },
      },
    });

    return redovi
      .map((red) => ({
        id: red.id,
        ocena: red.rating,
        naslov: red.title,
        komentar: red.comment,
        potpis: potpisKupca(red.user?.firstName ?? null, red.user?.lastName ?? null),
        verifikovan: red.verified,
        proizvod: red.product
          ? { slug: red.product.slug, naziv: red.product.name }
          : null,
      }))
      // `comment: { not: null }` propušta prazan string; utisak bez ijedne reči
      // je prazna kartica, pa se izbacuje ovde.
      .filter((utisak) => !samoSaKomentarom || (utisak.komentar ?? "").trim().length > 0);
  },
);

/* ------------------------------------------------------------------ *
 * Odbrojavanje
 * ------------------------------------------------------------------ */

/**
 * Aktivna akcija koja prva ističe.
 *
 * Vraća se ISO string, a ne `Date`: vrednost prelazi granicu servera i klijenta
 * i tamo bi se tiho pretvorila u string ionako.
 */
export const ucitajNajbliziIstekAkcije = cache(
  async (): Promise<{ naziv: string; istice: string } | null> => {
    const sada = new Date();
    const akcija = await prisma.promotion.findFirst({
      where: { isActive: true, startDate: { lte: sada }, endDate: { gt: sada } },
      orderBy: { endDate: "asc" },
      select: { name: true, endDate: true },
    });
    if (!akcija) return null;
    return { naziv: akcija.name, istice: akcija.endDate.toISOString() };
  },
);
