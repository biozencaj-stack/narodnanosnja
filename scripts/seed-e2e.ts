import { PrismaClient, Prisma } from "@prisma/client";
import { normalizeEmailAddress } from "../lib/auth/email-address";
import { hashPassword, validatePassword } from "../lib/auth/password";
import {
  createPrismaPrivilegedAccountDatabase,
  provisionPrivilegedAccount,
} from "../lib/auth/privileged-account";
import { podrazumevanRaspored } from "../lib/sekcije/podrazumevani-raspored";
import { podrazumevanaKonfiguracija } from "../lib/sekcije/registar";
import { PODRAZUMEVAN_UPIT } from "../lib/sekcije/upit-proizvoda";

if (process.env.E2E_DATABASE_SEED !== "true") {
  throw new Error(
    "E2E seed je dozvoljen samo uz E2E_DATABASE_SEED=true.",
  );
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL je obavezan za E2E seed.");
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
if (!/(?:^|[_-])(e2e|test|provera)(?:$|[_-])/i.test(databaseName)) {
  throw new Error(
    "E2E seed je odbijen: naziv baze mora jasno sadržati e2e, test ili provera.",
  );
}

/**
 * ADMIN nalog za Playwright provere admin ekrana.
 *
 * Stoji iza ISTOG guarda kao ostatak seed-a: bez `E2E_DATABASE_SEED=true` i bez
 * naziva baze koji jasno kaže da je test baza, ovaj fajl uopšte ne stigne
 * dovde. Lozinka je javna i namenjena samo test bazi.
 *
 * Nalog se pravi kroz `provisionPrivilegedAccount`, isti put kojim ide
 * `scripts/create-admin.ts` — ne ručnim `prisma.user.create` sa bcrypt hešom.
 * Time E2E nalog dobija isto verified stanje i isto brisanje reset/verification
 * tokena kao pravi administrator, pa verified-login politika ne obori prijavu.
 */
const adminEmail = normalizeEmailAddress(
  process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com",
);
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin!2026";

if (!adminEmail) {
  throw new Error("E2E_ADMIN_EMAIL nije ispravna email adresa.");
}

const lozinka = validatePassword(adminPassword);
if (!lozinka.valid) {
  throw new Error(
    `E2E_ADMIN_PASSWORD ne ispunjava uslove: ${lozinka.errors.join("; ")}`,
  );
}

const prisma = new PrismaClient();

/**
 * Sekcije za `pageKey="home"`.
 *
 * Seed upisuje TAČNO ugrađeni raspored iz `podrazumevani-raspored.ts`, kao
 * objavljene sekcije. Time se postiže dvoje: E2E ima šta da uređuje, a
 * renderovana početna ostaje ista kao kad bi se koristio povratak na ugrađeni
 * raspored — pa postojeći mobilni test kupovine ne vidi nikakvu promenu.
 *
 * Redosled u nizu je i redosled na stranici; `publishedAt` se postavlja jer
 * javni čitač ne prikazuje sekcije bez njega.
 */
/**
 * Dodatni blok proizvoda za proveru da sekcija NE pamti cenu.
 *
 * Konfiguracija nosi samo izvor `snizeno` — ni jednu cenu. Ako se na početnoj
 * vidi tačna snižena cena zasejanog proizvoda, znači da je pročitana sa servera
 * pri prikazu. Blok je e2e-only i zato ne stoji u ugrađenom rasporedu.
 */
function blokSnizenog(): { id: string; kind: string; config: Record<string, unknown> } {
  return {
    id: "e2e-blok-snizeno",
    kind: "proizvodi",
    config: {
      ...podrazumevanaKonfiguracija("proizvodi"),
      naslov: { sr: "E2E sniženo", en: "E2E sale" },
      upit: { ...PODRAZUMEVAN_UPIT, izvor: "snizeno", broj: 4 },
      kolone: "4",
    },
  };
}

async function zasejSekcije(): Promise<void> {
  const raspored = [...podrazumevanRaspored("home"), blokSnizenog()];
  const trenutak = new Date();

  for (const [redniBroj, sekcija] of raspored.entries()) {
    await prisma.pageSection.upsert({
      where: { id: sekcija.id },
      update: {
        kind: sekcija.kind,
        order: redniBroj,
        isActive: true,
        config: sekcija.config as Prisma.InputJsonObject,
        draftConfig: Prisma.DbNull,
        draftOrder: null,
        draftIsActive: null,
        publishedAt: trenutak,
      },
      create: {
        id: sekcija.id,
        pageKey: "home",
        kind: sekcija.kind,
        order: redniBroj,
        isActive: true,
        config: sekcija.config as Prisma.InputJsonObject,
        publishedAt: trenutak,
      },
    });
  }
}

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: "e2e-test-kategorija" },
    update: {
      name: { sr: "E2E test kategorija", en: "E2E test category" },
      active: true,
      showInNav: true,
    },
    create: {
      slug: "e2e-test-kategorija",
      name: { sr: "E2E test kategorija", en: "E2E test category" },
      active: true,
      showInNav: true,
      navOrder: 999,
      sortOrder: 999,
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: "e2e-test-proizvod" },
    update: {
      name: { sr: "E2E test proizvod", en: "E2E test product" },
      description: {
        sr: "<p>Proizvod za automatsku proveru kupovine.</p>",
        en: "<p>Product used by the automated purchase check.</p>",
      },
      categoryId: category.id,
      price: 1990,
      salePrice: null,
      active: true,
      featured: false,
      onSale: false,
      novo: false,
      tags: ["e2e"],
    },
    create: {
      slug: "e2e-test-proizvod",
      sku: "E2E-TEST-001",
      name: { sr: "E2E test proizvod", en: "E2E test product" },
      description: {
        sr: "<p>Proizvod za automatsku proveru kupovine.</p>",
        en: "<p>Product used by the automated purchase check.</p>",
      },
      categoryId: category.id,
      price: 1990,
      active: true,
      featured: false,
      onSale: false,
      novo: false,
      tags: ["e2e"],
    },
  });

  await prisma.productCategory.upsert({
    where: {
      productId_categoryId: {
        productId: product.id,
        categoryId: category.id,
      },
    },
    update: {},
    create: { productId: product.id, categoryId: category.id },
  });

  // Sniženi proizvod postoji samo zbog bloka proizvoda: puna cena 4.000, snižena
  // 2.500, što je tačno 38% popusta. Vrednosti su okrugle da se u testu tvrdi
  // tačan tekst, ne zaokruživanje.
  await prisma.product.upsert({
    where: { slug: "e2e-snizeni-proizvod" },
    update: {
      name: { sr: "E2E sniženi proizvod", en: "E2E discounted product" },
      categoryId: category.id,
      price: 4000,
      salePrice: 2500,
      active: true,
      featured: false,
      onSale: true,
      novo: false,
      tags: ["e2e"],
    },
    create: {
      slug: "e2e-snizeni-proizvod",
      sku: "E2E-TEST-002",
      name: { sr: "E2E sniženi proizvod", en: "E2E discounted product" },
      categoryId: category.id,
      price: 4000,
      salePrice: 2500,
      active: true,
      featured: false,
      onSale: true,
      novo: false,
      tags: ["e2e"],
    },
  });

  await zasejSekcije();

  await prisma.productSize.upsert({
    where: {
      productId_size: { productId: product.id, size: "Univerzalna" },
    },
    update: { stock: 10, active: true },
    create: {
      productId: product.id,
      size: "Univerzalna",
      stock: 10,
      active: true,
    },
  });

  // `updateExisting` je obavezan: seed je idempotentan i mora da zatekne nalog
  // iz prethodnog pokretanja bez pada.
  const rezultat = await provisionPrivilegedAccount(
    {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      updateExisting: true,
    },
    createPrismaPrivilegedAccountDatabase(prisma),
  );

  if (rezultat.kind !== "created" && rezultat.kind !== "updated") {
    throw new Error(`E2E ADMIN nalog nije obezbeđen: ${rezultat.kind}`);
  }

  await proveriDaSeNalogMozePrijaviti();
}

/**
 * Nalog koji se ne može prijaviti nije obezbeđen nalog.
 *
 * `evaluateVerifiedLoginPolicy` odbija snimak u kome je `emailVerified` raniji
 * od `createdAt` ili kasniji od trenutka ocene, i tada prijava puca sa
 * `POLICY_DECISION / INTERNAL_FAILURE`. U dnevniku to izgleda kao kvar
 * politike, a zapravo je nemoguć redosled u podacima — greška koja se inače
 * primeti tek kad E2E prijava padne, daleko od mesta nastanka.
 *
 * Vrednosti se čitaju istim izrazima kao pri prijavi: `AT TIME ZONE 'UTC'` nad
 * kolonama bez vremenske zone i `clock_timestamp()` za trenutak ocene.
 */
async function proveriDaSeNalogMozePrijaviti(): Promise<void> {
  const redovi = await prisma.$queryRaw<
    {
      createdAt: Date;
      emailVerified: Date | null;
      evaluatedAt: Date;
    }[]
  >`
    SELECT
      "createdAt" AT TIME ZONE 'UTC' AS "createdAt",
      "emailVerified" AT TIME ZONE 'UTC' AS "emailVerified",
      clock_timestamp()::timestamptz(3) AS "evaluatedAt"
    FROM public."User"
    WHERE "email" = ${adminEmail}
  `;

  const red = redovi[0];
  if (!red) {
    throw new Error("E2E ADMIN nalog nije pronađen posle upisa.");
  }

  const opis =
    `createdAt=${red.createdAt.toISOString()} ` +
    `emailVerified=${red.emailVerified?.toISOString() ?? "null"} ` +
    `evaluatedAt=${red.evaluatedAt.toISOString()}`;

  if (red.emailVerified === null) {
    throw new Error(`E2E ADMIN nalog nije verifikovan. ${opis}`);
  }

  if (red.emailVerified.getTime() < red.createdAt.getTime()) {
    throw new Error(
      "E2E ADMIN nalog ima emailVerified RANIJI od createdAt, pa politika " +
        `prijave odbija njegov snimak. ${opis}`,
    );
  }

  if (red.emailVerified.getTime() > red.evaluatedAt.getTime()) {
    throw new Error(
      "E2E ADMIN nalog ima emailVerified u budućnosti u odnosu na sat baze. " +
        opis,
    );
  }

  if (red.createdAt.getTime() > red.evaluatedAt.getTime()) {
    throw new Error(
      `E2E ADMIN nalog je napravljen u budućnosti u odnosu na sat baze. ${opis}`,
    );
  }

  console.log(`E2E ADMIN vremenski redosled je ispravan. ${opis}`);
}

main()
  .then(() => {
    console.log(`E2E katalog i ADMIN nalog (${adminEmail}) su spremni.`);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
