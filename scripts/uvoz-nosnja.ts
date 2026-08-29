/**
 * Uvoz kategorija i proizvoda narodne nošnje u bazu.
 *
 *   npx tsx scripts/uvoz-nosnja.ts
 *
 * Čita podatke iz podaci/ i upisuje ih preko slug-a, pa se može
 * pokretati više puta — postojeći zapisi se dopunjuju, ne dupliraju.
 * Ništa ne briše.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const KOREN = join(dirname(fileURLToPath(import.meta.url)), '..');
const PODACI = join(KOREN, 'podaci');

type Kategorija = {
  slug: string;
  naziv: string;
  kratko: string;
  opis: string;
  boje: string[];
};

type Proizvod = {
  slug: string;
  naziv: string;
  sifra: string;
  kategorija: string;
  cena: number;
  staraCena: number | null;
  stanje: 'na-stanju' | 'rasprodato' | 'po-porudzbini';
  istaknut: boolean;
  materijal: string[];
  dimenzije: string;
  opis: string;
  detalji: [string, string][];
  redosled: number;
};

/** Dvojezično polje. Engleski prevod još ne postoji, pa stoji srpski tekst. */
const dvojezicno = (sr: string) => ({ sr, en: sr }) as Prisma.InputJsonValue;

/** Iz „180 × 45 cm (bez resa)“ vadi dužinu i širinu u centimetrima. */
function razdvojDimenzije(tekst: string): { duzina?: number; sirina?: number } {
  const m = tekst.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return {};
  const broj = (s: string) => Number(s.replace(',', '.'));
  return { duzina: broj(m[1]), sirina: broj(m[2]) };
}

/** Uputstvo za održavanje iz liste detalja, ako ga proizvod ima. */
function nadjiOdrzavanje(detalji: [string, string][]): string | null {
  const red = detalji.find(([k]) => /održavanj/i.test(k));
  return red ? red[1] : null;
}

/**
 * Zaliha po stanju. „Po porudžbini“ dobija zalihu jer se takav
 * proizvod i dalje može naručiti, samo se duže čeka.
 */
const zalihaZa = (stanje: Proizvod['stanje']) =>
  stanje === 'rasprodato' ? 0 : stanje === 'po-porudzbini' ? 99 : 10;

async function main() {
  console.log('Uvoz podataka o narodnoj nošnji\n');

  /* ---------------- Kategorije ---------------- */

  const { kategorije } = JSON.parse(
    readFileSync(join(PODACI, 'kategorije.json'), 'utf8'),
  ) as { kategorije: Kategorija[] };

  const idPoSlugu = new Map<string, string>();

  for (const [i, k] of kategorije.entries()) {
    const zapis = await prisma.category.upsert({
      where: { slug: k.slug },
      update: {
        name: dvojezicno(k.naziv),
        description: dvojezicno(k.opis),
        showInNav: true,
        navOrder: i + 1,
        sortOrder: i + 1,
        active: true,
      },
      create: {
        slug: k.slug,
        name: dvojezicno(k.naziv),
        description: dvojezicno(k.opis),
        showInNav: true,
        navOrder: i + 1,
        sortOrder: i + 1,
        active: true,
      },
    });
    idPoSlugu.set(k.slug, zapis.id);
    console.log(`  kategorija  ${k.naziv}`);
  }

  /* ---------------- Proizvodi ---------------- */

  const fajlovi = readdirSync(join(PODACI, 'proizvodi'))
    .filter((f) => f.endsWith('.json'))
    .sort();

  let uvezeno = 0;

  for (const f of fajlovi) {
    const p = JSON.parse(
      readFileSync(join(PODACI, 'proizvodi', f), 'utf8'),
    ) as Proizvod;

    const categoryId = idPoSlugu.get(p.kategorija);
    if (!categoryId) {
      throw new Error(`Proizvod „${p.slug}“ traži nepoznatu kategoriju „${p.kategorija}“.`);
    }

    const naSnizenju = p.staraCena != null && p.staraCena > p.cena;
    const { duzina, sirina } = razdvojDimenzije(p.dimenzije);
    const odrzavanje = nadjiOdrzavanje(p.detalji);

    // Dimenzije i ostali detalji idu u opis jer ih kupac traži uz tekst,
    // a ne kao odvojena polja.
    const opisSaDetaljima = [
      p.opis,
      '',
      `Dimenzije: ${p.dimenzije}`,
      ...p.detalji.map(([k, v]) => `${k}: ${v}`),
    ].join('\n');

    const zajednicko = {
      name: dvojezicno(p.naziv),
      description: dvojezicno(opisSaDetaljima),
      sku: p.sifra,
      // Kad je sniženo, puna cena ide u price a snižena u salePrice —
      // tako sajt sam precrtava staru cenu.
      price: new Prisma.Decimal(naSnizenju ? p.staraCena! : p.cena),
      salePrice: naSnizenju ? new Prisma.Decimal(p.cena) : null,
      onSale: naSnizenju,
      categoryId,
      featured: p.istaknut,
      active: true,
      material: p.materijal.join(', '),
      length: duzina != null ? new Prisma.Decimal(duzina) : null,
      width: sirina != null ? new Prisma.Decimal(sirina) : null,
      countryOfOrigin: 'Srbija',
      careInstructions: odrzavanje ? dvojezicno(odrzavanje) : Prisma.DbNull,
      tags: [...new Set([...p.materijal, 'ručni rad', 'narodna nošnja'])],
      metaTitle: dvojezicno(p.naziv),
      metaDescription: dvojezicno(p.opis.split('\n')[0].slice(0, 155)),
    };

    const zapis = await prisma.product.upsert({
      where: { slug: p.slug },
      update: zajednicko,
      create: { slug: p.slug, ...zajednicko },
    });

    // Jedna „univerzalna“ veličina — ovi komadi se ne prodaju po brojevima,
    // osim čarapa i košulje, ali to se uređuje kroz admin panel.
    const zaliha = zalihaZa(p.stanje);
    const postojeca = await prisma.productSize.findFirst({
      where: { productId: zapis.id, size: 'Univerzalna' },
    });
    if (postojeca) {
      await prisma.productSize.update({
        where: { id: postojeca.id },
        data: { stock: zaliha },
      });
    } else {
      await prisma.productSize.create({
        data: { productId: zapis.id, size: 'Univerzalna', stock: zaliha },
      });
    }

    uvezeno++;
    const oznaka = naSnizenju ? ' (sniženo)' : p.stanje === 'rasprodato' ? ' (rasprodato)' : '';
    console.log(`  proizvod    ${p.naziv}${oznaka}`);
  }

  console.log(
    `\nGotovo: ${kategorije.length} kategorija, ${uvezeno} proizvoda.`,
  );
  console.log('Napomena: engleski prevodi još ne postoje — svuda stoji srpski tekst.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
