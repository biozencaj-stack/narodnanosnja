import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script for E-commerce CMS Template
 *
 * Creates:
 * - Default settings
 * - Sample categories
 * - Sample brands
 * - Sample products with sizes
 * - Sample articles
 * - Ticker messages
 *
 * NOTE: Admin user is created separately with:
 *   npx tsx scripts/create-admin.ts --email admin@example.com --password YourPassword123! --role ADMIN
 */

async function main() {
  console.log("Starting seed...");

  // ============================================
  // DEFAULT SETTINGS
  // ============================================
  const settings = [
    {
      key: "store_name",
      value: process.env.NEXT_PUBLIC_STORE_NAME || "My Store",
    },
    { key: "store_email", value: "info@example.com" },
    { key: "store_phone", value: "" },
    { key: "free_shipping_threshold", value: "5000" },
    { key: "shipping_cost", value: "390" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log("Default settings created");

  // ============================================
  // SAMPLE CATEGORIES
  // ============================================
  const categories = [
    {
      name: "Elektronika",
      slug: "elektronika",
      description: "Elektronski uređaji i gadžeti",
      sortOrder: 1,
    },
    {
      name: "Odeća",
      slug: "odeca",
      description: "Muška i ženska odeća",
      sortOrder: 2,
    },
    {
      name: "Moda",
      slug: "obuca",
      description: "Odeća, obuća i aksesori",
      sortOrder: 3,
    },
    {
      name: "Dodaci",
      slug: "dodaci",
      description: "Torbe, nakit i modni dodaci",
      sortOrder: 4,
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
      },
      create: { ...cat, active: true },
    });
  }
  console.log("Sample categories created");

  // ============================================
  // SAMPLE BRANDS
  // ============================================
  const brands = [
    {
      name: "Brand Alpha",
      slug: "brand-alpha",
      description: "Premium kvalitet",
      sortOrder: 1,
    },
    {
      name: "Brand Beta",
      slug: "brand-beta",
      description: "Povoljni proizvodi",
      sortOrder: 2,
    },
    {
      name: "Brand Gamma",
      slug: "brand-gamma",
      description: "Sportska oprema",
      sortOrder: 3,
    },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {
        name: brand.name,
        description: brand.description,
        sortOrder: brand.sortOrder,
      },
      create: { ...brand, active: true },
    });
  }
  console.log("Sample brands created");

  // ============================================
  // SAMPLE PRODUCTS
  // ============================================
  const electronicsCategory = await prisma.category.findUnique({
    where: { slug: "elektronika" },
  });
  const clothingCategory = await prisma.category.findUnique({
    where: { slug: "odeca" },
  });
  const alphaBrand = await prisma.brand.findUnique({
    where: { slug: "brand-alpha" },
  });
  const betaBrand = await prisma.brand.findUnique({
    where: { slug: "brand-beta" },
  });

  const sampleProducts = [
    {
      name: "Bežične slušalice Pro",
      slug: "bezicne-slusalice-pro",
      description:
        "Premium bežične slušalice sa aktivnim poništavanjem buke. Trajanje baterije do 30 sati.",
      sku: "ELEC-001",
      price: 12990,
      salePrice: 9990,
      categoryId: electronicsCategory?.id,
      brandId: alphaBrand?.id,
      active: true,
      featured: true,
      onSale: true,
      metaTitle: "Bežične slušalice Pro - Najbolji zvuk",
      metaDescription:
        "Kupite premium bežične slušalice sa ANC tehnologijom po akcijskoj ceni.",
    },
    {
      name: "Pamučna majica Classic",
      slug: "pamucna-majica-classic",
      description:
        "Klasična pamučna majica od 100% organskog pamuka. Dostupna u više boja i veličina.",
      sku: "CLOTH-001",
      price: 2490,
      categoryId: clothingCategory?.id,
      brandId: betaBrand?.id,
      gender: "unisex",
      active: true,
      featured: true,
      onSale: false,
    },
    {
      name: "Smart Watch X1",
      slug: "smart-watch-x1",
      description:
        "Pametni sat sa praćenjem zdravlja, GPS-om i dugotrajnom baterijom.",
      sku: "ELEC-002",
      price: 24990,
      salePrice: 19990,
      categoryId: electronicsCategory?.id,
      brandId: alphaBrand?.id,
      active: true,
      featured: false,
      onSale: true,
    },
  ];

  for (const product of sampleProducts) {
    const existing = await prisma.product.findUnique({
      where: { slug: product.slug },
    });
    if (!existing) {
      const created = await prisma.product.create({ data: product });

      // Add sample sizes for clothing
      if (product.categoryId === clothingCategory?.id) {
        await prisma.productSize.createMany({
          data: [
            { productId: created.id, size: "S", stock: 10 },
            { productId: created.id, size: "M", stock: 15 },
            { productId: created.id, size: "L", stock: 12 },
            { productId: created.id, size: "XL", stock: 8 },
          ],
        });
      }
    }
  }
  console.log("Sample products created");

  // ============================================
  // SAMPLE ARTICLES
  // ============================================
  const articles = [
    {
      title: "Dobrodošli u naš webshop",
      slug: "dobrodosli-u-nas-webshop",
      content:
        "<p>Dragi kupci,</p><p>Dobrodošli u naš novi online shop! Ovde ćete pronaći širok asortiman kvalitetnih proizvoda po povoljnim cenama.</p><p>Naš tim je tu da vam pomogne sa svakim pitanjem. Slobodno nas kontaktirajte!</p>",
      excerpt:
        "Predstavljamo vam naš novi online shop sa širokim asortimanom proizvoda.",
      author: "Admin",
      published: true,
      publishedAt: new Date(),
    },
    {
      title: "Vodič za kupovinu",
      slug: "vodic-za-kupovinu",
      content:
        "<h2>Kako kupovati na našem sajtu</h2><p>1. Pretražite proizvode ili koristite kategorije</p><p>2. Izaberite veličinu i dodajte u korpu</p><p>3. Popunite podatke za dostavu</p><p>4. Izaberite način plaćanja</p><p>5. Potvrdite porudžbinu</p><p>I to je to! Vaš paket stiže za 2-3 radna dana.</p>",
      excerpt: "Korak po korak vodič za kupovinu na našem sajtu.",
      author: "Admin",
      published: true,
      publishedAt: new Date(),
    },
  ];

  for (const article of articles) {
    const existing = await prisma.article.findUnique({
      where: { slug: article.slug },
    });
    if (!existing) {
      await prisma.article.create({ data: article });
    }
  }
  console.log("Sample articles created");

  // ============================================
  // DEFAULT TICKER MESSAGES
  // ============================================
  const existingTickers = await prisma.tickerMessage.count();
  if (existingTickers === 0) {
    await prisma.tickerMessage.createMany({
      data: [
        {
          text: "Brza dostava na vašu adresu",
          order: 0,
          isActive: true,
        },
        {
          text: "Kvalitetni proizvodi po najboljim cenama",
          order: 1,
          isActive: true,
        },
        { text: "30 dana za zamenu ili povraćaj", order: 2, isActive: true },
      ],
    });
    console.log("Ticker messages created");
  }

  console.log("\nSeed completed successfully!");
  console.log("\nTo create an admin user, run:");
  console.log(
    "  npx tsx scripts/create-admin.ts --email admin@example.com --password YourPassword123! --role ADMIN\n",
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
