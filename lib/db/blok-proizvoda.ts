import { cache } from "react";
import { prisma } from "./index";
import {
  kljucUpita,
  planUpita,
  poredjajPoIzboru,
  upitIzKljuca,
  type KorakUpita,
} from "@/lib/sekcije/upit-proizvoda";
import type { VrednostUpitaProizvoda } from "@/lib/sekcije/polja";

/**
 * Upiti bloka proizvoda.
 *
 * Namerno NIJE u `lib/products.ts`: taj fajl ima `"use server"` na prvoj
 * liniji, pa bi svaka nova izvezena funkcija postala javna Server Action —
 * krajnja tačka koju bilo ko sa interneta može pozvati POST zahtevom, sa
 * argumentima koje sam izabere. Blok proizvoda čita katalog po admin
 * konfiguraciji i takvu površinu ne sme da otvori. Test
 * `blok-proizvoda.test.ts` čuva to pravilo.
 *
 * Cena se ovde čita pri svakom prikazu i nikad se ne upisuje u konfiguraciju
 * sekcije. Početna stranica je najvidljivija stranica sajta; zapamćena cena bi
 * tamo najduže i najglasnije bila pogrešna.
 */

/** Oblik koji `LocalProductCard` prima. Isti kao `ProductCardData`. */
export interface KarticaProizvoda {
  id: string;
  slug: string;
  name: unknown;
  price: number;
  salePrice: number | null;
  image1: string | null;
  image2: string | null;
  onSale: boolean;
  novo: boolean;
  category: { name: unknown } | null;
  brand: { name: unknown } | null;
}

const IZBOR_KARTICE = {
  id: true,
  slug: true,
  name: true,
  price: true,
  salePrice: true,
  image1: true,
  image2: true,
  onSale: true,
  novo: true,
  category: { select: { name: true } },
  brand: { select: { name: true } },
} as const;

type RedKartice = {
  id: string;
  slug: string;
  name: unknown;
  price: unknown;
  salePrice: unknown;
  image1: string | null;
  image2: string | null;
  onSale: boolean;
  novo: boolean;
  category: { name: unknown } | null;
  brand: { name: unknown } | null;
};

/** `Decimal` ne prelazi granicu servera i klijenta — pretvara se u broj ovde. */
function uKarticu(red: RedKartice): KarticaProizvoda {
  return {
    id: red.id,
    slug: red.slug,
    name: red.name,
    price: Number(red.price),
    salePrice: red.salePrice === null ? null : Number(red.salePrice),
    image1: red.image1,
    image2: red.image2,
    onSale: red.onSale,
    novo: red.novo,
    category: red.category,
    brand: red.brand,
  };
}

async function izvrsiKorak(korak: KorakUpita): Promise<KarticaProizvoda[]> {
  const redovi = await prisma.product.findMany({
    where: korak.where,
    orderBy: korak.orderBy,
    take: korak.take,
    select: IZBOR_KARTICE,
  });
  return redovi.map(uKarticu);
}

/**
 * Keširana izvedba po ključu upita.
 *
 * React `cache()` pamti po identitetu argumenata, pa se prosleđuje string, a ne
 * objekat: dva bloka istog izvora i broja tada pogode isti unos i naprave jedan
 * upit ka bazi umesto dva. Keš važi u okviru jednog zahteva — dovoljno, jer je
 * početna `force-dynamic` i cena ionako mora biti sveža.
 */
const ucitajPoKljucu = cache(async (kljuc: string): Promise<KarticaProizvoda[]> => {
  const upit = upitIzKljuca(kljuc);
  const plan = planUpita(upit);
  if (plan.length === 0) return [];

  const delovi = await Promise.all(plan.map(izvrsiKorak));

  // Prvi korak ima prednost, sledeći dopunjuju onim što već nije uzeto. Tako
  // `izdvojenoISnizeno` daje isti redosled koji je zatečena početna imala.
  const vidjeni = new Set<string>();
  const spojeno: KarticaProizvoda[] = [];
  for (const deo of delovi) {
    for (const proizvod of deo) {
      if (vidjeni.has(proizvod.id)) continue;
      vidjeni.add(proizvod.id);
      spojeno.push(proizvod);
    }
  }

  const poredjano =
    upit.izvor === "izabrani" ? poredjajPoIzboru(spojeno, upit.izabrani) : spojeno;

  const granica = Math.max(...plan.map((korak) => korak.take));
  return poredjano.slice(0, granica);
});

/**
 * Proizvodi za jedan blok. Greška upita se ne guta ovde — sekcija sama odlučuje
 * da li da se ne prikaže, kao što je i pre radila.
 */
export function ucitajBlokProizvoda(
  upit: VrednostUpitaProizvoda,
): Promise<KarticaProizvoda[]> {
  return ucitajPoKljucu(kljucUpita(upit));
}
