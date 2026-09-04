import { cache } from "react";
import { prisma } from "./index";
import {
  kljucUpita,
  planUpita,
  poredjajPoIzboru,
  poredjajPoRedosledu,
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

/**
 * Identifikatori najbolje ocenjenih proizvoda, poređani po proseku ocena.
 *
 * Prosek se ne može izraziti kao `orderBy` nad `Product`, pa ide grupisanje po
 * `ProductReview`. Dva detalja se ne smeju izgubiti:
 *
 * - `productId` je nullable kolona, a recenzija vezana samo za ERP šifru bi
 *   inače napravila grupu sa ključem `null` koja se ne može spojiti ni sa jednim
 *   proizvodom. Zato filter `productId: { not: null }` nije opcion.
 * - `getProductReviewStats` agregira po `productCode`, a ne po `productId`. To
 *   NIJE isti ključ i njegov rezultat se ovde ne može ponovo upotrebiti.
 *
 * Pri jednakom proseku prednost ima proizvod sa više recenzija: pet petica je
 * jače svedočanstvo od jedne.
 */
async function idjeviNajboljeOcenjenih(koliko: number): Promise<string[]> {
  const grupe = await prisma.productReview.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, product: { active: true } },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return grupe
    .filter((grupa): grupa is typeof grupa & { productId: string } =>
      typeof grupa.productId === "string",
    )
    .sort((a, b) => {
      const razlika = (b._avg.rating ?? 0) - (a._avg.rating ?? 0);
      return razlika !== 0 ? razlika : b._count._all - a._count._all;
    })
    .slice(0, koliko)
    .map((grupa) => grupa.productId);
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
  const idjevi =
    upit.izvor === "najboljeOcenjeni"
      ? await idjeviNajboljeOcenjenih(upit.broj)
      : undefined;
  const plan = planUpita(upit, { idjeviNajboljeOcenjenih: idjevi });
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

  // Za oba izvora sa spoljnim redosledom `ORDER BY` u bazi ne daje traženi red,
  // pa se poredak vraća ovde.
  let poredjano = spojeno;
  if (upit.izvor === "izabrani") {
    poredjano = poredjajPoIzboru(spojeno, upit.izabrani);
  } else if (idjevi) {
    poredjano = poredjajPoRedosledu(spojeno, idjevi, (proizvod) => proizvod.id);
  }

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
