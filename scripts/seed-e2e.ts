import { PrismaClient } from "@prisma/client";
import { normalizeEmailAddress } from "../lib/auth/email-address";
import { hashPassword, validatePassword } from "../lib/auth/password";
import {
  createPrismaPrivilegedAccountDatabase,
  provisionPrivilegedAccount,
} from "../lib/auth/privileged-account";

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
}

main()
  .then(() => {
    console.log(`E2E katalog i ADMIN nalog (${adminEmail}) su spremni.`);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
