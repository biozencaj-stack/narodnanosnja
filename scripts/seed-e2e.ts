import { PrismaClient, Prisma } from "@prisma/client";
import { podrazumevanRaspored } from "../lib/sekcije/podrazumevani-raspored";

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
async function zasejSekcije(): Promise<void> {
  const raspored = podrazumevanRaspored("home");
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
}

main()
  .then(() => {
    console.log("E2E katalog je spreman.");
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
