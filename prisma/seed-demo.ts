import { PrismaClient, Role, OrderStatus, PaymentMethod, PaymentStatus, PromotionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Comprehensive demo seed for marketing screenshots.
 *
 * Creates: settings, colors, brands, categories, products (30) with sizes,
 * users (5), addresses, orders (12), reviews (20), promotions (4),
 * banners (4), articles (3), ticker messages, newsletter subscribers, chat FAQ.
 *
 * Run: npx tsx prisma/seed-demo.ts
 */

// Helper: date N days ago
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

// Helper: generate order number
const orderNum = (n: number) => `ORD-2026-${String(n).padStart(5, "0")}`;

async function main() {
  console.log("Starting comprehensive demo seed...\n");

  // ===========================================================================
  // SETTINGS
  // ===========================================================================
  const settings = [
    { key: "store_name", value: "DemoShop" },
    { key: "store_email", value: "info@demoshop.rs" },
    { key: "store_phone", value: "+381 11 123 4567" },
    { key: "free_shipping_threshold", value: "5000" },
    { key: "shipping_cost", value: "390" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log("  Settings created");

  // ===========================================================================
  // COLORS
  // ===========================================================================
  const colorData = [
    { name: "Crna", hex: "#000000" },
    { name: "Bela", hex: "#FFFFFF" },
    { name: "Crvena", hex: "#DC2626" },
    { name: "Plava", hex: "#2563EB" },
    { name: "Teget", hex: "#1E3A5F" },
    { name: "Zelena", hex: "#16A34A" },
    { name: "Bež", hex: "#D4A574" },
    { name: "Siva", hex: "#6B7280" },
    { name: "Braon", hex: "#8B4513" },
    { name: "Roze", hex: "#EC4899" },
  ];
  for (const c of colorData) {
    const existing = await prisma.color.findUnique({ where: { name: c.name } });
    if (!existing) await prisma.color.create({ data: { ...c, active: true } });
  }
  console.log("  Colors created");

  // ===========================================================================
  // BRANDS
  // ===========================================================================
  const brandsData = [
    { name: "Urban Style", slug: "urban-style", description: "Gradski streetwear za svaki dan", sortOrder: 1 },
    { name: "SportMax", slug: "sportmax", description: "Sportska oprema vrhunskog kvaliteta", sortOrder: 2 },
    { name: "EcoWear", slug: "ecowear", description: "Održiva moda od organskih materijala", sortOrder: 3 },
    { name: "LuxLine", slug: "luxline", description: "Premium kolekcija za posebne prilike", sortOrder: 4 },
    { name: "TechGear", slug: "techgear", description: "Pametni gadgeti i satovi", sortOrder: 5 },
    { name: "ClassicCo", slug: "classicco", description: "Klasičan stil koji nikada ne izlazi iz mode", sortOrder: 6 },
  ];
  const brands: Record<string, string> = {};
  for (const b of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, description: b.description, sortOrder: b.sortOrder },
      create: { ...b, active: true },
    });
    brands[b.slug] = brand.id;
  }
  console.log("  Brands created");

  // ===========================================================================
  // CATEGORIES (with hierarchy)
  // ===========================================================================
  const parentCats = [
    { name: "Obuća", slug: "obuca", description: "Patike, cipele i čizme", sortOrder: 1, image: "/uploads/categories/patike.jpg" },
    { name: "Odeća", slug: "odeca", description: "Jakne, majice i pantalone", sortOrder: 2, image: "/uploads/categories/jakne.jpg" },
    { name: "Torbe", slug: "torbe", description: "Torbe, rančevi i torbice", sortOrder: 3, image: "/uploads/categories/torbe.jpg" },
    { name: "Satovi", slug: "satovi", description: "Ručni satovi i pametni satovi", sortOrder: 4, image: "/uploads/categories/satovi.jpg" },
    { name: "Aksesori", slug: "aksesori", description: "Naočare, kaiševì, novčanici", sortOrder: 5, image: "/uploads/categories/aksesori.jpg" },
  ];

  const categories: Record<string, string> = {};
  for (const c of parentCats) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder, image: c.image },
      create: { ...c, active: true, showInNav: true, navOrder: c.sortOrder },
    });
    categories[c.slug] = cat.id;
  }

  // Subcategories
  const subCats = [
    { name: "Patike", slug: "patike", parentSlug: "obuca", description: "Sportske i lifestyle patike", sortOrder: 1 },
    { name: "Jakne", slug: "jakne", parentSlug: "odeca", description: "Zimske i prolećne jakne", sortOrder: 1, image: "/uploads/categories/jakne.jpg" },
    { name: "Majice", slug: "majice", parentSlug: "odeca", description: "Majice kratkih i dugih rukava", sortOrder: 2, image: "/uploads/categories/majice.jpg" },
  ];
  for (const sc of subCats) {
    const cat = await prisma.category.upsert({
      where: { slug: sc.slug },
      update: { name: sc.name, description: sc.description, sortOrder: sc.sortOrder, image: sc.image || null },
      create: {
        name: sc.name,
        slug: sc.slug,
        description: sc.description,
        sortOrder: sc.sortOrder,
        image: sc.image || null,
        parentId: categories[sc.parentSlug],
        active: true,
        showInNav: true,
        navOrder: sc.sortOrder,
      },
    });
    categories[sc.slug] = cat.id;
  }
  console.log("  Categories created");

  // ===========================================================================
  // PRODUCTS (30)
  // ===========================================================================
  interface ProductSeed {
    name: string;
    slug: string;
    description: string;
    sku: string;
    price: number;
    salePrice?: number;
    categorySlug: string;
    brandSlug: string;
    gender?: string;
    featured: boolean;
    onSale: boolean;
    novo: boolean;
    color: string;
    colorHex: string;
    material: string;
    tags: string[];
    image1: string;
    image2: string;
    image3: string;
    sizes: { size: string; stock: number }[];
  }

  const products: ProductSeed[] = [
    // --- PATIKE (8) ---
    {
      name: "Urban Runner Pro",
      slug: "urban-runner-pro",
      description: "Lagane patike za svakodnevno nošenje sa amortizujućim đonom. Idealne za gradske šetnje i aktivni životni stil. Gornji deo od prozračnog mesha za maksimalnu udobnost.",
      sku: "PAT-001",
      price: 12990,
      salePrice: 9990,
      categorySlug: "patike",
      brandSlug: "urban-style",
      gender: "unisex",
      featured: true,
      onSale: true,
      novo: false,
      color: "Crna",
      colorHex: "#000000",
      material: "Mesh/sintetika",
      tags: ["patike", "running", "crne", "urban"],
      image1: "/uploads/products/patike-urban-runner-1.jpg",
      image2: "/uploads/products/patike-urban-runner-2.jpg",
      image3: "/uploads/products/patike-urban-runner-3.jpg",
      sizes: [
        { size: "39", stock: 5 }, { size: "40", stock: 8 }, { size: "41", stock: 12 },
        { size: "42", stock: 15 }, { size: "43", stock: 10 }, { size: "44", stock: 6 },
      ],
    },
    {
      name: "Sport Boost X",
      slug: "sport-boost-x",
      description: "Profesionalne patike za trčanje sa Boost tehnologijom. Reaktivan đon za povratak energije pri svakom koraku. Continental guma za maksimalan grip.",
      sku: "PAT-002",
      price: 18990,
      categorySlug: "patike",
      brandSlug: "sportmax",
      gender: "muski",
      featured: true,
      onSale: false,
      novo: true,
      color: "Plava",
      colorHex: "#2563EB",
      material: "Primeknit/Boost",
      tags: ["patike", "running", "sport", "boost"],
      image1: "/uploads/products/patike-sport-boost-1.jpg",
      image2: "/uploads/products/patike-sport-boost-2.jpg",
      image3: "/uploads/products/patike-sport-boost-3.jpg",
      sizes: [
        { size: "40", stock: 6 }, { size: "41", stock: 10 }, { size: "42", stock: 14 },
        { size: "43", stock: 12 }, { size: "44", stock: 8 }, { size: "45", stock: 4 },
      ],
    },
    {
      name: "Classic 574 Heritage",
      slug: "classic-574-heritage",
      description: "Ikonični retro model koji kombinuje udobnost i stil. Zamšana koža sa mesh panelima. ENCAP amortizacija za celodevnu udobnost.",
      sku: "PAT-003",
      price: 14990,
      salePrice: 11990,
      categorySlug: "patike",
      brandSlug: "classicco",
      gender: "unisex",
      featured: false,
      onSale: true,
      novo: false,
      color: "Siva",
      colorHex: "#6B7280",
      material: "Zamša/mesh",
      tags: ["patike", "retro", "classic", "574"],
      image1: "/uploads/products/patike-classic-574-1.jpg",
      image2: "/uploads/products/patike-classic-574-2.jpg",
      image3: "/uploads/products/patike-classic-574-3.jpg",
      sizes: [
        { size: "38", stock: 3 }, { size: "39", stock: 7 }, { size: "40", stock: 10 },
        { size: "41", stock: 12 }, { size: "42", stock: 9 }, { size: "43", stock: 5 },
      ],
    },
    {
      name: "Retro 90s Vibe",
      slug: "retro-90s-vibe",
      description: "Devedesete su se vratile! Debeli đon, jarke boje i neprikosnovena udobnost. Idealne za one koji vole da se ističu.",
      sku: "PAT-004",
      price: 11490,
      categorySlug: "patike",
      brandSlug: "urban-style",
      gender: "zenski",
      featured: false,
      onSale: false,
      novo: true,
      color: "Bela",
      colorHex: "#FFFFFF",
      material: "Koža/tekstil",
      tags: ["patike", "retro", "90s", "chunky"],
      image1: "/uploads/products/patike-retro-90s-1.jpg",
      image2: "/uploads/products/patike-retro-90s-2.jpg",
      image3: "/uploads/products/patike-retro-90s-3.jpg",
      sizes: [
        { size: "36", stock: 4 }, { size: "37", stock: 8 }, { size: "38", stock: 10 },
        { size: "39", stock: 12 }, { size: "40", stock: 7 }, { size: "41", stock: 3 },
      ],
    },
    {
      name: "Air Pro Max",
      slug: "air-pro-max",
      description: "Ultimativna amortizacija sa punim Air jastukom. Premium materijali i inovativan dizajn za savremene sportiste.",
      sku: "PAT-005",
      price: 22990,
      salePrice: 17990,
      categorySlug: "patike",
      brandSlug: "sportmax",
      gender: "muski",
      featured: true,
      onSale: true,
      novo: false,
      color: "Crna",
      colorHex: "#000000",
      material: "Flyknit/Air Max",
      tags: ["patike", "air", "premium", "amortizacija"],
      image1: "/uploads/products/patike-air-pro-1.jpg",
      image2: "/uploads/products/patike-air-pro-2.jpg",
      image3: "/uploads/products/patike-air-pro-3.jpg",
      sizes: [
        { size: "41", stock: 6 }, { size: "42", stock: 10 }, { size: "43", stock: 14 },
        { size: "44", stock: 8 }, { size: "45", stock: 4 },
      ],
    },
    {
      name: "Street Flex Daily",
      slug: "street-flex-daily",
      description: "Fleksibilne patike za svaki dan. Lagan đon i mekana unutrašnjost za celodnevnu udobnost u urbanom okruženju.",
      sku: "PAT-006",
      price: 8990,
      categorySlug: "patike",
      brandSlug: "ecowear",
      gender: "unisex",
      featured: false,
      onSale: false,
      novo: false,
      color: "Zelena",
      colorHex: "#16A34A",
      material: "Reciklirani materijali",
      tags: ["patike", "eco", "flex", "svakodnevne"],
      image1: "/uploads/products/patike-street-flex-1.jpg",
      image2: "/uploads/products/patike-street-flex-2.jpg",
      image3: "/uploads/products/patike-street-flex-3.jpg",
      sizes: [
        { size: "39", stock: 8 }, { size: "40", stock: 12 }, { size: "41", stock: 15 },
        { size: "42", stock: 10 }, { size: "43", stock: 6 },
      ],
    },
    {
      name: "Trail Hiker Outdoor",
      slug: "trail-hiker-outdoor",
      description: "Robusne patike za planinu i teže terene. Vodootporna membrana, čvrst grip i zaštita za zglobove.",
      sku: "PAT-007",
      price: 16990,
      categorySlug: "patike",
      brandSlug: "sportmax",
      gender: "muski",
      featured: false,
      onSale: false,
      novo: false,
      color: "Braon",
      colorHex: "#8B4513",
      material: "Gore-Tex/Vibram",
      tags: ["patike", "hiking", "outdoor", "vodootporne"],
      image1: "/uploads/products/patike-trail-hiker-1.jpg",
      image2: "/uploads/products/patike-trail-hiker-2.jpg",
      image3: "/uploads/products/patike-trail-hiker-3.jpg",
      sizes: [
        { size: "40", stock: 5 }, { size: "41", stock: 8 }, { size: "42", stock: 10 },
        { size: "43", stock: 7 }, { size: "44", stock: 4 },
      ],
    },
    {
      name: "Minimal White Edition",
      slug: "minimal-white-edition",
      description: "Čiste linije i minimalističan dizajn. Premium bela koža sa diskretnim logom. Idealne za elegantne i casual kombinacije.",
      sku: "PAT-008",
      price: 13490,
      salePrice: 10490,
      categorySlug: "patike",
      brandSlug: "luxline",
      gender: "zenski",
      featured: true,
      onSale: true,
      novo: true,
      color: "Bela",
      colorHex: "#FFFFFF",
      material: "Premium koža",
      tags: ["patike", "minimalne", "bele", "elegantne"],
      image1: "/uploads/products/patike-minimal-white-1.jpg",
      image2: "/uploads/products/patike-minimal-white-2.jpg",
      image3: "/uploads/products/patike-minimal-white-3.jpg",
      sizes: [
        { size: "36", stock: 6 }, { size: "37", stock: 10 }, { size: "38", stock: 14 },
        { size: "39", stock: 12 }, { size: "40", stock: 8 },
      ],
    },

    // --- JAKNE (5) ---
    {
      name: "Puffer Jakna Zimska",
      slug: "puffer-jakna-zimska",
      description: "Topla puffer jakna sa sintetičkim punjenjem. Vodoodbojna spoljašnjost, elastične manžetne i kapuljača. Savršena za najhladnije dane.",
      sku: "JAK-001",
      price: 14990,
      salePrice: 11990,
      categorySlug: "jakne",
      brandSlug: "sportmax",
      gender: "muski",
      featured: true,
      onSale: true,
      novo: false,
      color: "Teget",
      colorHex: "#1E3A5F",
      material: "Najlon/sintetičko punjenje",
      tags: ["jakna", "puffer", "zima", "topla"],
      image1: "/uploads/products/jakna-puffer-1.jpg",
      image2: "/uploads/products/jakna-puffer-2.jpg",
      image3: "/uploads/products/jakna-puffer-3.jpg",
      sizes: [
        { size: "S", stock: 5 }, { size: "M", stock: 10 }, { size: "L", stock: 12 },
        { size: "XL", stock: 8 }, { size: "XXL", stock: 4 },
      ],
    },
    {
      name: "Kožna Biker Jakna",
      slug: "kozna-biker-jakna",
      description: "Klasična biker jakna od prave kože. Asimetrični rajsferšlus, metalni detalji i satenska podstava. Neizostavni komad svake garderobe.",
      sku: "JAK-002",
      price: 34990,
      categorySlug: "jakne",
      brandSlug: "luxline",
      gender: "zenski",
      featured: true,
      onSale: false,
      novo: false,
      color: "Crna",
      colorHex: "#000000",
      material: "100% prava koža",
      tags: ["jakna", "koža", "biker", "premium"],
      image1: "/uploads/products/jakna-kozna-1.jpg",
      image2: "/uploads/products/jakna-kozna-2.jpg",
      image3: "/uploads/products/jakna-kozna-3.jpg",
      sizes: [
        { size: "XS", stock: 3 }, { size: "S", stock: 6 }, { size: "M", stock: 8 },
        { size: "L", stock: 5 }, { size: "XL", stock: 2 },
      ],
    },
    {
      name: "Teksas Jakna Oversized",
      slug: "teksas-jakna-oversized",
      description: "Opušteni oversized kroj teksas jakne. Stonewash obrada, klasični džepovi sa dugmadima. Savršena za prelazni period.",
      sku: "JAK-003",
      price: 7990,
      categorySlug: "jakne",
      brandSlug: "urban-style",
      gender: "unisex",
      featured: false,
      onSale: false,
      novo: true,
      color: "Plava",
      colorHex: "#2563EB",
      material: "100% pamučni teksas",
      tags: ["jakna", "teksas", "denim", "oversized"],
      image1: "/uploads/products/jakna-denim-1.jpg",
      image2: "/uploads/products/jakna-denim-2.jpg",
      image3: "/uploads/products/jakna-denim-3.jpg",
      sizes: [
        { size: "S", stock: 8 }, { size: "M", stock: 14 }, { size: "L", stock: 12 },
        { size: "XL", stock: 6 },
      ],
    },
    {
      name: "Windbreaker Lagana Jakna",
      slug: "windbreaker-lagana-jakna",
      description: "Ultra lagana jakna koja štiti od vetra i kiše. Pakuje se u sopstveni džep. Idealna za sport i putovanja.",
      sku: "JAK-004",
      price: 6490,
      salePrice: 4990,
      categorySlug: "jakne",
      brandSlug: "sportmax",
      gender: "unisex",
      featured: false,
      onSale: true,
      novo: false,
      color: "Zelena",
      colorHex: "#16A34A",
      material: "Ripstop najlon",
      tags: ["jakna", "windbreaker", "lagana", "vodootporna"],
      image1: "/uploads/products/jakna-windbreaker-1.jpg",
      image2: "/uploads/products/jakna-windbreaker-2.jpg",
      image3: "/uploads/products/jakna-windbreaker-3.jpg",
      sizes: [
        { size: "S", stock: 10 }, { size: "M", stock: 15 }, { size: "L", stock: 12 },
        { size: "XL", stock: 8 },
      ],
    },
    {
      name: "Bomber Jakna Satin",
      slug: "bomber-jakna-satin",
      description: "Moderna bomber jakna sa satenskom spoljašnjošću. Elastični rubovi, dva bočna džepa. Savršen spoj casual i elegantnog stila.",
      sku: "JAK-005",
      price: 9990,
      categorySlug: "jakne",
      brandSlug: "urban-style",
      gender: "muski",
      featured: false,
      onSale: false,
      novo: true,
      color: "Crna",
      colorHex: "#000000",
      material: "Saten/poliester",
      tags: ["jakna", "bomber", "saten", "moderna"],
      image1: "/uploads/products/jakna-bomber-1.jpg",
      image2: "/uploads/products/jakna-bomber-2.jpg",
      image3: "/uploads/products/jakna-bomber-3.jpg",
      sizes: [
        { size: "S", stock: 6 }, { size: "M", stock: 10 }, { size: "L", stock: 12 },
        { size: "XL", stock: 8 }, { size: "XXL", stock: 4 },
      ],
    },

    // --- MAJICE (5) ---
    {
      name: "Basic Pamučna Majica",
      slug: "basic-pamucna-majica",
      description: "Esencijalna pamučna majica od 100% organskog pamuka. Klasičan kroj, ribbed okovratnik. Savršena baza za svaki outfit.",
      sku: "MAJ-001",
      price: 2490,
      categorySlug: "majice",
      brandSlug: "ecowear",
      gender: "unisex",
      featured: false,
      onSale: false,
      novo: false,
      color: "Bela",
      colorHex: "#FFFFFF",
      material: "100% organski pamuk",
      tags: ["majica", "basic", "pamuk", "organski"],
      image1: "/uploads/products/majica-basic-1.jpg",
      image2: "/uploads/products/majica-basic-2.jpg",
      image3: "/uploads/products/majica-basic-3.jpg",
      sizes: [
        { size: "S", stock: 20 }, { size: "M", stock: 25 }, { size: "L", stock: 20 },
        { size: "XL", stock: 15 }, { size: "XXL", stock: 10 },
      ],
    },
    {
      name: "Graphic Print Majica",
      slug: "graphic-print-majica",
      description: "Moderna majica sa unikatnim grafičkim printom. Kvalitetan DTG print koji ne bledi nakon pranja. Relax fit kroj.",
      sku: "MAJ-002",
      price: 3490,
      salePrice: 2790,
      categorySlug: "majice",
      brandSlug: "urban-style",
      gender: "muski",
      featured: false,
      onSale: true,
      novo: false,
      color: "Crna",
      colorHex: "#000000",
      material: "Pamuk/elastin",
      tags: ["majica", "graphic", "print", "streetwear"],
      image1: "/uploads/products/majica-graphic-1.jpg",
      image2: "/uploads/products/majica-graphic-2.jpg",
      image3: "/uploads/products/majica-graphic-3.jpg",
      sizes: [
        { size: "S", stock: 10 }, { size: "M", stock: 15 }, { size: "L", stock: 12 },
        { size: "XL", stock: 8 },
      ],
    },
    {
      name: "Polo Majica Premium",
      slug: "polo-majica-premium",
      description: "Elegantna polo majica od pique pamuka. Dvotono dugmad, diskretni logo na grudima. Za poslovne i casual prilike.",
      sku: "MAJ-003",
      price: 4990,
      categorySlug: "majice",
      brandSlug: "classicco",
      gender: "muski",
      featured: true,
      onSale: false,
      novo: false,
      color: "Teget",
      colorHex: "#1E3A5F",
      material: "Pique pamuk",
      tags: ["majica", "polo", "elegantna", "business-casual"],
      image1: "/uploads/products/majica-polo-1.jpg",
      image2: "/uploads/products/majica-polo-2.jpg",
      image3: "/uploads/products/majica-polo-3.jpg",
      sizes: [
        { size: "S", stock: 8 }, { size: "M", stock: 12 }, { size: "L", stock: 10 },
        { size: "XL", stock: 6 }, { size: "XXL", stock: 3 },
      ],
    },
    {
      name: "Henley Majica Dugih Rukava",
      slug: "henley-majica-dugih-rukava",
      description: "Casual henley majica sa tri dugmeta. Waffle tekstura, prijazan materijal idealan za layering. Savršena za jesen.",
      sku: "MAJ-004",
      price: 3990,
      categorySlug: "majice",
      brandSlug: "ecowear",
      gender: "muski",
      featured: false,
      onSale: false,
      novo: true,
      color: "Bež",
      colorHex: "#D4A574",
      material: "Pamuk/modal",
      tags: ["majica", "henley", "dugi-rukavi", "jesen"],
      image1: "/uploads/products/majica-henley-1.jpg",
      image2: "/uploads/products/majica-henley-2.jpg",
      image3: "/uploads/products/majica-henley-3.jpg",
      sizes: [
        { size: "S", stock: 6 }, { size: "M", stock: 10 }, { size: "L", stock: 12 },
        { size: "XL", stock: 8 },
      ],
    },
    {
      name: "Oversized Majica Street",
      slug: "oversized-majica-street",
      description: "Trendovska oversized majica sa spuštenim ramenima. Heavy-weight pamuk za premium osećaj. Pogodna za layering.",
      sku: "MAJ-005",
      price: 3290,
      categorySlug: "majice",
      brandSlug: "urban-style",
      gender: "unisex",
      featured: false,
      onSale: false,
      novo: true,
      color: "Siva",
      colorHex: "#6B7280",
      material: "Heavy-weight pamuk 300gsm",
      tags: ["majica", "oversized", "street", "heavy"],
      image1: "/uploads/products/majica-oversized-1.jpg",
      image2: "/uploads/products/majica-oversized-2.jpg",
      image3: "/uploads/products/majica-oversized-3.jpg",
      sizes: [
        { size: "M", stock: 14 }, { size: "L", stock: 18 }, { size: "XL", stock: 10 },
      ],
    },

    // --- TORBE (4) ---
    {
      name: "Kožna Tote Torba",
      slug: "kozna-tote-torba",
      description: "Prostrana tote torba od prave kože. Unutrašnji džep za laptop, magnetno zatvaranje. Za posao i svaki dan.",
      sku: "TOR-001",
      price: 12990,
      categorySlug: "torbe",
      brandSlug: "luxline",
      gender: "zenski",
      featured: true,
      onSale: false,
      novo: false,
      color: "Braon",
      colorHex: "#8B4513",
      material: "Prava koža",
      tags: ["torba", "tote", "koža", "posao"],
      image1: "/uploads/products/torba-tote-1.jpg",
      image2: "/uploads/products/torba-tote-2.jpg",
      image3: "/uploads/products/torba-tote-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 15 }],
    },
    {
      name: "Urban Ranac Canvas",
      slug: "urban-ranac-canvas",
      description: "Funkcionalni gradski ranac od vodootpornog canvasa. Pregradu za laptop 15\", više organizacionih džepova. Podesivi kaiševì.",
      sku: "TOR-002",
      price: 6990,
      salePrice: 5490,
      categorySlug: "torbe",
      brandSlug: "urban-style",
      gender: "unisex",
      featured: false,
      onSale: true,
      novo: false,
      color: "Siva",
      colorHex: "#6B7280",
      material: "Voskovan canvas",
      tags: ["torba", "ranac", "canvas", "laptop"],
      image1: "/uploads/products/torba-backpack-1.jpg",
      image2: "/uploads/products/torba-backpack-2.jpg",
      image3: "/uploads/products/torba-backpack-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 20 }],
    },
    {
      name: "Crossbody Torbica Mini",
      slug: "crossbody-torbica-mini",
      description: "Kompaktna crossbody torbica sa podesivim kaišem. Dovoljno prostrana za telefon, novčanik i ključeve. Savršena za izlaske.",
      sku: "TOR-003",
      price: 4990,
      categorySlug: "torbe",
      brandSlug: "classicco",
      gender: "zenski",
      featured: false,
      onSale: false,
      novo: true,
      color: "Crna",
      colorHex: "#000000",
      material: "Eko koža",
      tags: ["torba", "crossbody", "mini", "izlasci"],
      image1: "/uploads/products/torba-crossbody-1.jpg",
      image2: "/uploads/products/torba-crossbody-2.jpg",
      image3: "/uploads/products/torba-crossbody-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 25 }],
    },
    {
      name: "Sportska Duffle Torba",
      slug: "sportska-duffle-torba",
      description: "Velika duffle torba za trening i putovanja. Vodootporni materijal, odeljak za obuću, bočni džepovi za flašice.",
      sku: "TOR-004",
      price: 5990,
      categorySlug: "torbe",
      brandSlug: "sportmax",
      gender: "unisex",
      featured: false,
      onSale: false,
      novo: false,
      color: "Teget",
      colorHex: "#1E3A5F",
      material: "Najlon 1000D",
      tags: ["torba", "duffle", "sport", "putovanje"],
      image1: "/uploads/products/torba-duffle-1.jpg",
      image2: "/uploads/products/torba-duffle-2.jpg",
      image3: "/uploads/products/torba-duffle-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 12 }],
    },

    // --- SATOVI (4) ---
    {
      name: "Classic Analog Sat",
      slug: "classic-analog-sat",
      description: "Elegantan analogni sat sa kožnim kaišem. Švajcarski mehanizam, safirno staklo, vodootpornost do 50m. Savršen poklon.",
      sku: "SAT-001",
      price: 24990,
      categorySlug: "satovi",
      brandSlug: "classicco",
      gender: "muski",
      featured: true,
      onSale: false,
      novo: false,
      color: "Braon",
      colorHex: "#8B4513",
      material: "Nerđajući čelik/koža",
      tags: ["sat", "analogni", "klasičan", "koža"],
      image1: "/uploads/products/sat-classic-1.jpg",
      image2: "/uploads/products/sat-classic-2.jpg",
      image3: "/uploads/products/sat-classic-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 8 }],
    },
    {
      name: "Smart Watch Pro X",
      slug: "smart-watch-pro-x",
      description: "Napredni pametni sat sa AMOLED ekranom. GPS, pulsometar, SpO2 senzor, 14 dana baterije. Kompatibilan sa iOS i Android.",
      sku: "SAT-002",
      price: 29990,
      salePrice: 24990,
      categorySlug: "satovi",
      brandSlug: "techgear",
      gender: "unisex",
      featured: true,
      onSale: true,
      novo: true,
      color: "Crna",
      colorHex: "#000000",
      material: "Aluminijum/silikon",
      tags: ["sat", "smart", "fitness", "gps"],
      image1: "/uploads/products/sat-smart-1.jpg",
      image2: "/uploads/products/sat-smart-2.jpg",
      image3: "/uploads/products/sat-smart-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 15 }],
    },
    {
      name: "Sport Chronograph",
      slug: "sport-chronograph",
      description: "Sportski hronograf sa tačnošću od 1/10 sekunde. Čeličan kaiš, tachymeter lüneta, vodootpornost 100m.",
      sku: "SAT-003",
      price: 19990,
      categorySlug: "satovi",
      brandSlug: "sportmax",
      gender: "muski",
      featured: false,
      onSale: false,
      novo: false,
      color: "Siva",
      colorHex: "#6B7280",
      material: "Nerđajući čelik",
      tags: ["sat", "sport", "hronograf", "čelik"],
      image1: "/uploads/products/sat-sport-1.jpg",
      image2: "/uploads/products/sat-sport-2.jpg",
      image3: "/uploads/products/sat-sport-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 6 }],
    },
    {
      name: "Luxury Rose Gold Sat",
      slug: "luxury-rose-gold-sat",
      description: "Luksuzni sat sa rose gold prevlakom. Minimalistički dizajn, milanski kaiš. Elegantan aksesoar za svaku priliku.",
      sku: "SAT-004",
      price: 18990,
      categorySlug: "satovi",
      brandSlug: "luxline",
      gender: "zenski",
      featured: false,
      onSale: false,
      novo: true,
      color: "Roze",
      colorHex: "#EC4899",
      material: "Rose gold/milanski čelik",
      tags: ["sat", "luxury", "rose-gold", "elegantan"],
      image1: "/uploads/products/sat-luxury-1.jpg",
      image2: "/uploads/products/sat-luxury-2.jpg",
      image3: "/uploads/products/sat-luxury-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 10 }],
    },

    // --- AKSESORI (4) ---
    {
      name: "Polarizovane Naočare Classic",
      slug: "polarizovane-naocare-classic",
      description: "Klasične sunčane naočare sa polarizovanim sočivima. UV400 zaštita, čeličan ram. Dolaze sa tvrdim futrolom.",
      sku: "AKS-001",
      price: 5990,
      salePrice: 4490,
      categorySlug: "aksesori",
      brandSlug: "classicco",
      gender: "unisex",
      featured: false,
      onSale: true,
      novo: false,
      color: "Crna",
      colorHex: "#000000",
      material: "Metal/polarizovano staklo",
      tags: ["naočare", "sunčane", "polarizovane", "UV400"],
      image1: "/uploads/products/aksesoar-sunglasses-1.jpg",
      image2: "/uploads/products/aksesoar-sunglasses-2.jpg",
      image3: "/uploads/products/aksesoar-sunglasses-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 30 }],
    },
    {
      name: "Kožni Kaiš Premium",
      slug: "kozni-kais-premium",
      description: "Ručno rađen kaiš od pune kože. Čelična kopča, širina 3.5cm. Dostupan u više veličina.",
      sku: "AKS-002",
      price: 3490,
      categorySlug: "aksesori",
      brandSlug: "luxline",
      gender: "muski",
      featured: false,
      onSale: false,
      novo: false,
      color: "Braon",
      colorHex: "#8B4513",
      material: "Puna koža",
      tags: ["kaiš", "koža", "premium", "ručni-rad"],
      image1: "/uploads/products/aksesoar-belt-1.jpg",
      image2: "/uploads/products/aksesoar-belt-2.jpg",
      image3: "/uploads/products/aksesoar-belt-3.jpg",
      sizes: [
        { size: "S (85cm)", stock: 5 }, { size: "M (95cm)", stock: 10 },
        { size: "L (105cm)", stock: 8 }, { size: "XL (115cm)", stock: 4 },
      ],
    },
    {
      name: "Kožni Novčanik RFID",
      slug: "kozni-novcanik-rfid",
      description: "Kompaktan kožni novčanik sa RFID zaštitom. 8 slotova za kartice, pregrada za novčanice, džep za sitninu.",
      sku: "AKS-003",
      price: 4490,
      categorySlug: "aksesori",
      brandSlug: "classicco",
      gender: "muski",
      featured: false,
      onSale: false,
      novo: false,
      color: "Crna",
      colorHex: "#000000",
      material: "Prava koža/RFID folija",
      tags: ["novčanik", "koža", "RFID", "kompaktan"],
      image1: "/uploads/products/aksesoar-wallet-1.jpg",
      image2: "/uploads/products/aksesoar-wallet-2.jpg",
      image3: "/uploads/products/aksesoar-wallet-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 18 }],
    },
    {
      name: "Vuneni Šal Premium",
      slug: "vuneni-sal-premium",
      description: "Mekan vuneni šal od merino vune. Dimenzije 180x30cm. Idealan za hladne zimske dane. Pakuje se u poklon kutiju.",
      sku: "AKS-004",
      price: 2990,
      salePrice: 1990,
      categorySlug: "aksesori",
      brandSlug: "ecowear",
      gender: "unisex",
      featured: false,
      onSale: true,
      novo: false,
      color: "Bež",
      colorHex: "#D4A574",
      material: "100% merino vuna",
      tags: ["šal", "vuneni", "merino", "zima"],
      image1: "/uploads/products/aksesoar-scarf-1.jpg",
      image2: "/uploads/products/aksesoar-scarf-2.jpg",
      image3: "/uploads/products/aksesoar-scarf-3.jpg",
      sizes: [{ size: "ONE SIZE", stock: 22 }],
    },
  ];

  const productIds: Record<string, string> = {};

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      productIds[p.slug] = existing.id;
      continue;
    }

    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        sku: p.sku,
        price: p.price,
        salePrice: p.salePrice ?? null,
        categoryId: categories[p.categorySlug],
        brandId: brands[p.brandSlug],
        gender: p.gender ?? null,
        active: true,
        featured: p.featured,
        onSale: p.onSale,
        novo: p.novo,
        color: p.color,
        colorHex: p.colorHex,
        material: p.material,
        tags: p.tags,
        image1: p.image1,
        image2: p.image2,
        image3: p.image3,
        metaTitle: `${p.name} | DemoShop`,
        metaDescription: p.description.slice(0, 155),
      },
    });

    await prisma.productSize.createMany({
      data: p.sizes.map((s) => ({
        productId: created.id,
        size: s.size,
        stock: s.stock,
      })),
    });

    // Also link to parent category via ProductCategory
    const catSlug = p.categorySlug;
    const parentSlug =
      catSlug === "patike" ? "obuca" : catSlug === "jakne" || catSlug === "majice" ? "odeca" : null;
    if (parentSlug && categories[parentSlug]) {
      await prisma.productCategory.create({
        data: { productId: created.id, categoryId: categories[parentSlug] },
      }).catch(() => {});
    }
    if (categories[catSlug]) {
      await prisma.productCategory.create({
        data: { productId: created.id, categoryId: categories[catSlug] },
      }).catch(() => {});
    }

    productIds[p.slug] = created.id;
  }
  console.log(`  Products created (${Object.keys(productIds).length})`);

  // ===========================================================================
  // USERS (5)
  // ===========================================================================
  const passwordHash = await bcrypt.hash("Demo1234!", 12);

  const usersData = [
    { email: "admin@demo.rs", firstName: "Admin", lastName: "Demo", role: Role.ADMIN },
    { email: "operator@demo.rs", firstName: "Operator", lastName: "Demo", role: Role.OPERATOR },
    { email: "marko@demo.rs", firstName: "Marko", lastName: "Petrović", role: Role.CUSTOMER },
    { email: "jelena@demo.rs", firstName: "Jelena", lastName: "Nikolić", role: Role.CUSTOMER },
    { email: "nikola@demo.rs", firstName: "Nikola", lastName: "Jovanović", role: Role.CUSTOMER },
  ];

  const userIds: Record<string, string> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, role: u.role, emailVerified: new Date() },
      create: { ...u, passwordHash, emailVerified: new Date(), newsletterOptIn: true },
    });
    userIds[u.email] = user.id;
  }
  console.log("  Users created");

  // ===========================================================================
  // ADDRESSES
  // ===========================================================================
  const addressesData = [
    { userId: userIds["marko@demo.rs"], street: "Knez Mihailova 25", city: "Beograd", postalCode: "11000", isDefault: true },
    { userId: userIds["marko@demo.rs"], street: "Bulevar Mihajla Pupina 10", city: "Novi Sad", postalCode: "21000", isDefault: false },
    { userId: userIds["jelena@demo.rs"], street: "Obala Stefana Prvovenčanog 3", city: "Niš", postalCode: "18000", isDefault: true },
    { userId: userIds["jelena@demo.rs"], street: "Terazije 5", city: "Beograd", postalCode: "11000", isDefault: false },
  ];
  for (const a of addressesData) {
    const existing = await prisma.address.findFirst({
      where: { userId: a.userId, street: a.street },
    });
    if (!existing) await prisma.address.create({ data: a });
  }
  console.log("  Addresses created");

  // ===========================================================================
  // ORDERS (12)
  // ===========================================================================
  const ordersData = [
    // 3x PENDING
    {
      orderNumber: orderNum(10001),
      userId: userIds["marko@demo.rs"],
      shippingStreet: "Knez Mihailova 25", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.PENDING,
      subtotal: 12990, shipping: 390, discount: 0, total: 13380,
      createdAt: daysAgo(1),
      items: [{ slug: "urban-runner-pro", size: "42", quantity: 1, price: 9990 }],
    },
    {
      orderNumber: orderNum(10002),
      userId: userIds["jelena@demo.rs"],
      shippingStreet: "Obala Stefana Prvovenčanog 3", shippingCity: "Niš", shippingPostal: "18000",
      paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.PENDING,
      subtotal: 39980, shipping: 0, discount: 3998, total: 35982,
      couponCode: "POPUST10",
      createdAt: daysAgo(2),
      items: [
        { slug: "kozna-biker-jakna", size: "M", quantity: 1, price: 34990 },
        { slug: "polo-majica-premium", size: "S", quantity: 1, price: 4990 },
      ],
    },
    {
      orderNumber: orderNum(10003),
      guestEmail: "gost@gmail.com", guestFirstName: "Milan", guestLastName: "Đorđević", guestPhone: "+381641234567",
      shippingStreet: "Vojvode Stepe 100", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.PENDING,
      subtotal: 8990, shipping: 390, discount: 0, total: 9380,
      createdAt: daysAgo(1),
      items: [{ slug: "street-flex-daily", size: "41", quantity: 1, price: 8990 }],
    },
    // 3x CONFIRMED
    {
      orderNumber: orderNum(10004),
      userId: userIds["marko@demo.rs"],
      shippingStreet: "Knez Mihailova 25", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      subtotal: 29990, shipping: 0, discount: 0, total: 29990,
      createdAt: daysAgo(5),
      items: [{ slug: "smart-watch-pro-x", size: "ONE SIZE", quantity: 1, price: 24990 }],
    },
    {
      orderNumber: orderNum(10005),
      userId: userIds["jelena@demo.rs"],
      shippingStreet: "Terazije 5", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.CONFIRMED,
      subtotal: 17480, shipping: 0, discount: 0, total: 17480,
      createdAt: daysAgo(6),
      items: [
        { slug: "kozna-tote-torba", size: "ONE SIZE", quantity: 1, price: 12990 },
        { slug: "polarizovane-naocare-classic", size: "ONE SIZE", quantity: 1, price: 4490 },
      ],
    },
    {
      orderNumber: orderNum(10006),
      userId: userIds["marko@demo.rs"],
      shippingStreet: "Bulevar Mihajla Pupina 10", shippingCity: "Novi Sad", shippingPostal: "21000",
      paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      subtotal: 7480, shipping: 0, discount: 0, total: 7480,
      createdAt: daysAgo(7),
      items: [
        { slug: "basic-pamucna-majica", size: "L", quantity: 2, price: 2490 },
        { slug: "basic-pamucna-majica", size: "M", quantity: 1, price: 2490 },
      ],
    },
    // 4x SHIPPED
    {
      orderNumber: orderNum(10007),
      userId: userIds["marko@demo.rs"],
      shippingStreet: "Knez Mihailova 25", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.SHIPPED,
      subtotal: 22990, shipping: 0, discount: 0, total: 22990,
      trackingNumber: "CE20260001234RS",
      createdAt: daysAgo(10),
      items: [{ slug: "air-pro-max", size: "43", quantity: 1, price: 17990 }],
    },
    {
      orderNumber: orderNum(10008),
      userId: userIds["jelena@demo.rs"],
      shippingStreet: "Obala Stefana Prvovenčanog 3", shippingCity: "Niš", shippingPostal: "18000",
      paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.SHIPPED,
      subtotal: 11490, shipping: 0, discount: 0, total: 11490,
      trackingNumber: "CE20260005678RS",
      createdAt: daysAgo(12),
      items: [
        { slug: "teksas-jakna-oversized", size: "M", quantity: 1, price: 7990 },
        { slug: "graphic-print-majica", size: "M", quantity: 1, price: 2790 },
      ],
    },
    {
      orderNumber: orderNum(10009),
      userId: userIds["marko@demo.rs"],
      shippingStreet: "Knez Mihailova 25", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.SHIPPED,
      subtotal: 24990, shipping: 0, discount: 0, total: 24990,
      trackingNumber: "CE20260009012RS",
      createdAt: daysAgo(15),
      items: [{ slug: "classic-analog-sat", size: "ONE SIZE", quantity: 1, price: 24990 }],
    },
    {
      orderNumber: orderNum(10010),
      userId: userIds["jelena@demo.rs"],
      shippingStreet: "Terazije 5", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.SHIPPED,
      subtotal: 6990, shipping: 390, discount: 0, total: 7380,
      trackingNumber: "CE20260003456RS",
      note: "Molim vas da ostavite pošiljku kod portira.",
      createdAt: daysAgo(18),
      items: [
        { slug: "urban-ranac-canvas", size: "ONE SIZE", quantity: 1, price: 5490 },
        { slug: "vuneni-sal-premium", size: "ONE SIZE", quantity: 1, price: 1990 },
      ],
    },
    // 2x CANCELLED
    {
      orderNumber: orderNum(10011),
      userId: userIds["marko@demo.rs"],
      shippingStreet: "Knez Mihailova 25", shippingCity: "Beograd", shippingPostal: "11000",
      paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.CANCELLED,
      subtotal: 14990, shipping: 0, discount: 0, total: 14990,
      createdAt: daysAgo(20),
      items: [{ slug: "puffer-jakna-zimska", size: "L", quantity: 1, price: 11990 }],
    },
    {
      orderNumber: orderNum(10012),
      guestEmail: "ana@gmail.com", guestFirstName: "Ana", guestLastName: "Ilić", guestPhone: "+381659876543",
      shippingStreet: "Kralja Petra 15", shippingCity: "Kragujevac", shippingPostal: "34000",
      paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.FAILED,
      status: OrderStatus.CANCELLED,
      subtotal: 18990, shipping: 0, discount: 0, total: 18990,
      createdAt: daysAgo(25),
      items: [{ slug: "sport-boost-x", size: "40", quantity: 1, price: 18990 }],
    },
  ];

  for (const o of ordersData) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: o.orderNumber } });
    if (existing) continue;

    const { items, ...orderData } = o;

    const order = await prisma.order.create({
      data: {
        orderNumber: orderData.orderNumber,
        userId: orderData.userId ?? null,
        guestEmail: orderData.guestEmail ?? null,
        guestFirstName: orderData.guestFirstName ?? null,
        guestLastName: orderData.guestLastName ?? null,
        guestPhone: orderData.guestPhone ?? null,
        shippingStreet: orderData.shippingStreet,
        shippingCity: orderData.shippingCity,
        shippingPostal: orderData.shippingPostal,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus,
        status: orderData.status,
        subtotal: orderData.subtotal,
        shipping: orderData.shipping,
        discount: orderData.discount,
        total: orderData.total,
        couponCode: orderData.couponCode ?? null,
        trackingNumber: orderData.trackingNumber ?? null,
        note: orderData.note ?? null,
        createdAt: orderData.createdAt,
      },
    });

    for (const item of items) {
      const product = products.find((p) => p.slug === item.slug);
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: productIds[item.slug] ?? null,
          productCode: product?.sku ?? item.slug,
          productName: product?.name ?? item.slug,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          picture: product?.image1 ?? null,
        },
      });
    }

    // Create transaction for CARD + PAID orders
    if (orderData.paymentMethod === PaymentMethod.CARD && orderData.paymentStatus === PaymentStatus.PAID) {
      await prisma.transaction.create({
        data: {
          orderId: order.id,
          transId: `TX${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
          authCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
          amount: orderData.total,
          currency: "RSD",
          status: "APPROVED",
        },
      });
    }
  }
  console.log("  Orders created");

  // ===========================================================================
  // REVIEWS (20)
  // ===========================================================================
  const reviewsData = [
    { productSlug: "urban-runner-pro", userEmail: "marko@demo.rs", rating: 5, title: "Odlične patike!", comment: "Vrlo udobne, nosim ih svaki dan na posao. Amortizacija je fantastična." },
    { productSlug: "urban-runner-pro", userEmail: "jelena@demo.rs", rating: 4, title: "Skoro savršene", comment: "Jako lepe i udobne, ali malo uže u prednjem delu. Preporučujem pola broja veći." },
    { productSlug: "sport-boost-x", userEmail: "marko@demo.rs", rating: 5, title: "Najbolje za trčanje", comment: "Trčim maraton u njima. Boost amortizacija je na drugom nivou." },
    { productSlug: "classic-574-heritage", userEmail: "jelena@demo.rs", rating: 5, title: "Klasika koja ne razočarava", comment: "Kupila sam ih kao poklon mužu, oduševljen je. Kvalitet je odličan." },
    { productSlug: "air-pro-max", userEmail: "marko@demo.rs", rating: 4, title: "Premium kvalitet", comment: "Flyknit materijal je fantastičan. Air amortizacija se zaista oseti. Jedina zamerka - cena." },
    { productSlug: "minimal-white-edition", userEmail: "jelena@demo.rs", rating: 5, title: "Prelepe bele patike", comment: "Elegantan dizajn, lako se kombinuju sa svime. Koža je mekana i kvalitetna." },
    { productSlug: "puffer-jakna-zimska", userEmail: "marko@demo.rs", rating: 4, title: "Topla i kvalitetna", comment: "Preživeo sam -15°C bez problema. Jedino kapuljača mogla malo veća." },
    { productSlug: "kozna-biker-jakna", userEmail: "jelena@demo.rs", rating: 5, title: "Investicija u stil", comment: "Koža je mekana, šavovi perfektni. Izgleda još bolje uživo nego na slikama." },
    { productSlug: "teksas-jakna-oversized", userEmail: "marko@demo.rs", rating: 4, title: "Savršena za proleće", comment: "Oversized kroj je baš onako kako treba. Materijal je čvrst ali ne krut." },
    { productSlug: "basic-pamucna-majica", userEmail: "jelena@demo.rs", rating: 5, title: "Kupujem ponovo!", comment: "Naručila 5 komada u različitim bojama. Pamuk je super kvalitetan, ne skuplja se." },
    { productSlug: "basic-pamucna-majica", userEmail: "marko@demo.rs", rating: 4, title: "Solidna osnova", comment: "Za ovu cenu nema bolje majice. Organski pamuk je mekši od običnog." },
    { productSlug: "polo-majica-premium", userEmail: "marko@demo.rs", rating: 5, title: "Elegancija na poslu", comment: "Nosim je za sastanke i poslovne ručkove. Izgleda skuplje nego što jeste." },
    { productSlug: "kozna-tote-torba", userEmail: "jelena@demo.rs", rating: 5, title: "Savršena poslovna torba", comment: "Staje laptop 14\", fascikle i još mnogo toga. Koža je predivna." },
    { productSlug: "urban-ranac-canvas", userEmail: "marko@demo.rs", rating: 4, title: "Praktičan za svaki dan", comment: "Canvas je vodootporan, staje sve što mi treba. Jedino rajsferšlus malo tvrd." },
    { productSlug: "classic-analog-sat", userEmail: "marko@demo.rs", rating: 5, title: "Elegantan poklon", comment: "Kupio za godišnjicu. Švajcarski mehanizam radi besprekorno. Safirno staklo nema ogrebotina." },
    { productSlug: "smart-watch-pro-x", userEmail: "jelena@demo.rs", rating: 4, title: "Odličan pametni sat", comment: "GPS preciznost odlična, baterija traje 12 dana. Mogao bi imati više watch face-ova." },
    { productSlug: "smart-watch-pro-x", userEmail: "marko@demo.rs", rating: 5, title: "Zamena za telefon", comment: "Plaćam NFC-om, pratim trening, čitam poruke. Sve na jednom mestu." },
    { productSlug: "polarizovane-naocare-classic", userEmail: "jelena@demo.rs", rating: 4, title: "Dobar odnos cene i kvaliteta", comment: "Polarizacija odlično radi, ram je čvrst. Futrola je bonus." },
    { productSlug: "kozni-novcanik-rfid", userEmail: "marko@demo.rs", rating: 5, title: "Kompaktan i funkcionalan", comment: "RFID zaštita je bitna u današnje vreme. Svih 8 kartica staju bez problema." },
    { productSlug: "vuneni-sal-premium", userEmail: "jelena@demo.rs", rating: 5, title: "Mekan kao oblak", comment: "Merino vuna ne grebé uopšte. Poklon kutija je lep detalj za poklanjanje." },
  ];

  for (const r of reviewsData) {
    const productId = productIds[r.productSlug];
    const userId = userIds[r.userEmail];
    const product = products.find((p) => p.slug === r.productSlug);
    if (!productId || !userId || !product) continue;

    const existing = await prisma.productReview.findUnique({
      where: { productCode_userId: { productCode: product.sku, userId } },
    });
    if (!existing) {
      await prisma.productReview.create({
        data: {
          productId,
          productCode: product.sku,
          userId,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          verified: true,
          createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
        },
      });
    }
  }
  console.log("  Reviews created");

  // ===========================================================================
  // PROMOTIONS (4)
  // ===========================================================================
  const promotionsData = [
    {
      name: "Popust 10%",
      description: "10% popusta na celu porudžbinu sa kupon kodom",
      type: PromotionType.PERCENT_OFF,
      value: 10,
      code: "POPUST10",
      startDate: daysAgo(30),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      isActive: true,
      stackable: false,
    },
    {
      name: "Letnja Rasprodaja 2026",
      description: "15% popusta na odabrane proizvode za leto 2026",
      type: PromotionType.PERCENT_OFF,
      value: 15,
      code: "LETO2026",
      startDate: daysAgo(7),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
      stackable: false,
    },
    {
      name: "Besplatna Dostava",
      description: "Besplatna dostava za porudžbine preko 5.000 RSD",
      type: PromotionType.FREE_SHIPPING,
      value: 0,
      minCartValue: 5000,
      startDate: daysAgo(60),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      stackable: true,
    },
    {
      name: "Kupi 2 - Treći 50% Jeftinije",
      description: "Kupite 2 majice i treću dobijate sa 50% popusta",
      type: PromotionType.QUANTITY_DISCOUNT,
      value: 50,
      minQuantity: 3,
      startDate: daysAgo(14),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      stackable: false,
      quantityTiers: [{ qty: 2, discount: 10 }, { qty: 3, discount: 50 }],
    },
  ];

  for (const promo of promotionsData) {
    const existing = promo.code
      ? await prisma.promotion.findUnique({ where: { code: promo.code } })
      : await prisma.promotion.findFirst({ where: { name: promo.name } });
    if (!existing) {
      await prisma.promotion.create({
        data: {
          name: promo.name,
          description: promo.description,
          type: promo.type,
          value: promo.value,
          code: promo.code ?? null,
          minQuantity: promo.minQuantity ?? null,
          minCartValue: promo.minCartValue ?? null,
          startDate: promo.startDate,
          endDate: promo.endDate,
          isActive: promo.isActive,
          stackable: promo.stackable,
          quantityTiers: promo.quantityTiers ?? undefined,
        },
      });
    }
  }
  console.log("  Promotions created");

  // ===========================================================================
  // BANNERS (4) - using base64 approach since that's how the schema stores them
  // ===========================================================================
  // The Banner model stores imageData as base64. We'll read the banner images from disk.
  const fs = await import("fs");
  const path = await import("path");

  const bannersData = [
    {
      title: "Nova Kolekcija 2026",
      subtitle: "Otkrijte najnovije trendove",
      description: "Istražite našu novu kolekciju proljeće/ljeto 2026. Premium materijali, moderan dizajn.",
      filename: "banner-hero-1.jpg",
      linkUrl: "/catalog?novo=true",
      buttonText: "Pogledaj kolekciju",
      position: "home_hero",
      order: 0,
    },
    {
      title: "Velika Rasprodaja",
      subtitle: "Do -50% na odabrane artikle",
      description: "Ne propustite priliku! Popusti na patike, jakne i aksesoare. Količine su ograničene.",
      filename: "banner-hero-2.jpg",
      linkUrl: "/catalog?sale=true",
      buttonText: "Kupi sada",
      position: "home_hero",
      order: 1,
    },
    {
      title: "Premium Brend Spotlight",
      subtitle: "LuxLine kolekcija",
      description: "Upoznajte LuxLine - premium liniju za one koji cene kvalitet i eleganciju.",
      filename: "banner-hero-3.jpg",
      linkUrl: "/catalog/brend/luxline",
      buttonText: "Istraži brend",
      position: "home_hero",
      order: 2,
    },
    {
      title: "Besplatna Dostava",
      subtitle: "Za porudžbine preko 5.000 RSD",
      description: "Naručite danas i uživajte u besplatnoj dostavi na teritoriji cele Srbije.",
      filename: "banner-hero-4.jpg",
      linkUrl: "/catalog",
      buttonText: "Započni kupovinu",
      position: "home_hero",
      order: 3,
    },
  ];

  for (const b of bannersData) {
    const existingBanner = await prisma.banner.findFirst({
      where: { position: b.position },
    });
    if (existingBanner) continue;

    const imgPath = path.join(process.cwd(), "public", "uploads", "products", b.filename);
    let imageData = "";
    let contentType = "image/jpeg";
    try {
      const buffer = fs.readFileSync(imgPath);
      imageData = buffer.toString("base64");
    } catch {
      console.warn(`    Warning: Banner image not found: ${imgPath}`);
      continue;
    }

    await prisma.banner.create({
      data: {
        title: b.title,
        subtitle: b.subtitle,
        description: b.description,
        imageData,
        contentType,
        linkUrl: b.linkUrl,
        buttonText: b.buttonText,
        position: b.position,
        isActive: true,
        order: b.order,
      },
    });
  }
  console.log("  Banners created");

  // ===========================================================================
  // ARTICLES (3)
  // ===========================================================================
  const articlesData = [
    {
      title: "Nova Kolekcija Proleće/Leto 2026",
      slug: "nova-kolekcija-prolece-leto-2026",
      content: `<h2>Stigla je nova kolekcija!</h2>
<p>Sa zadovoljstvom vam predstavljamo našu najnoviju kolekciju za sezonu proleće/leto 2026. Ovogodišnji trendovi donose svež pristup klasičnom stilu sa naglašenim bojama i inovativnim materijalima.</p>
<h3>Ključni trendovi</h3>
<ul>
<li><strong>Održiva moda</strong> — Organski materijali i reciklirane tkanine</li>
<li><strong>Retro vibracije</strong> — Povratak devedesetih u savremenoj interpretaciji</li>
<li><strong>Minimalistički dizajn</strong> — Čiste linije i neutralne boje</li>
<li><strong>Sportski šik</strong> — Spoj udobnosti i elegancije</li>
</ul>
<p>Posetite naš katalog i otkrijte sve novitete. Besplatna dostava za porudžbine preko 5.000 RSD!</p>`,
      excerpt: "Predstavljamo novu kolekciju za proleće/leto 2026 sa najnovijim trendovima u modi.",
      image1: "/uploads/articles/nova-kolekcija.jpg",
      author: "DemoShop Tim",
      published: true,
      publishedAt: daysAgo(3),
    },
    {
      title: "Vodič za Održavanje Obuće",
      slug: "vodic-za-odrzavanje-obuce",
      content: `<h2>Kako da vaše patike traju duže</h2>
<p>Pravilno održavanje obuće može značajno produžiti njen vek trajanja. Evo naših saveta:</p>
<h3>1. Redovno čišćenje</h3>
<p>Nakon svake upotrebe, obrišite patike vlažnom krpom. Za dublje čišćenje, koristite blagi sapun i meku četkicu.</p>
<h3>2. Pravilno sušenje</h3>
<p>Nikada ne sušite patike na radijatoru ili direktnoj sunčevoj svetlosti. Umetnite novinski papir da upije vlagu.</p>
<h3>3. Skladištenje</h3>
<p>Čuvajte obuću u provetrenom prostoru. Koristite držače za oblik (shoe trees) za kožne cipele.</p>
<h3>4. Rotacija</h3>
<p>Ne nosite isti par svaki dan. Rotacija daje materijalima vreme da se oporave.</p>`,
      excerpt: "Naučite kako da pravilno održavate obuću i produžite njen vek trajanja.",
      image1: "/uploads/articles/odrzavanje-obuce.jpg",
      author: "DemoShop Tim",
      published: true,
      publishedAt: daysAgo(10),
    },
    {
      title: "Top 10 Modnih Trendova za 2026",
      slug: "top-10-modnih-trendova-2026",
      content: `<h2>Trendovi koji definišu 2026. godinu</h2>
<p>Moda se stalno menja, ali neki trendovi ove godine zaslužuju posebnu pažnju:</p>
<ol>
<li><strong>Chunky patike</strong> — Deblji đonovi se vraćaju</li>
<li><strong>Kožne jakne</strong> — Bezvremenski komad u novim varijantama</li>
<li><strong>Oversized kroj</strong> — Komfor je kralj</li>
<li><strong>Neutralne boje</strong> — Bež, krem i zemaljski tonovi</li>
<li><strong>Održivi brendovi</strong> — Eko-svesna moda</li>
<li><strong>Vintage aksesori</strong> — Retro naočare i satovi</li>
<li><strong>Layering</strong> — Slojevito oblačenje</li>
<li><strong>Tech wear</strong> — Funkcionalna odeća za grad</li>
<li><strong>Mini torbe</strong> — Kompaktne crossbody torbice</li>
<li><strong>Rose gold detalji</strong> — Nežne metalne nijanse</li>
</ol>
<p>Pogledajte naš asortiman i pronađite svoj stil za 2026!</p>`,
      excerpt: "Otkrijte najvažnijih 10 modnih trendova koji će obeležiti 2026. godinu.",
      image1: "/uploads/articles/top-trendovi.jpg",
      author: "DemoShop Tim",
      published: true,
      publishedAt: daysAgo(7),
    },
  ];

  for (const a of articlesData) {
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (!existing) await prisma.article.create({ data: a });
  }
  console.log("  Articles created");

  // ===========================================================================
  // TICKER MESSAGES
  // ===========================================================================
  await prisma.tickerMessage.deleteMany({});
  await prisma.tickerMessage.createMany({
    data: [
      { text: { sr: "Demo Admin: admin@demo.rs / Demo1234!", en: "Demo Admin: admin@demo.rs / Demo1234!" }, order: 0, isActive: true },
      { text: { sr: "Demo Operator: operator@demo.rs / Demo1234!", en: "Demo Operator: operator@demo.rs / Demo1234!" }, order: 1, isActive: true },
      { text: { sr: "Demo kupac: marko@demo.rs / Demo1234!", en: "Demo customer: marko@demo.rs / Demo1234!" }, order: 2, isActive: true },
      { text: { sr: "Demo kupac: jelena@demo.rs / Demo1234!", en: "Demo customer: jelena@demo.rs / Demo1234!" }, order: 3, isActive: true },
      { text: { sr: "Demo kupac: nikola@demo.rs / Demo1234!", en: "Demo customer: nikola@demo.rs / Demo1234!" }, order: 4, isActive: true },
      { text: "🚚 Besplatna dostava za porudžbine preko 5.000 RSD", order: 5, isActive: true },
      { text: "🏷️ POPUST10 — unesite kod za 10% popusta", order: 6, isActive: true },
      { text: "✨ Nova kolekcija proleće/leto 2026 je stigla!", order: 7, isActive: true },
      { text: "📦 Brza dostava — 2-3 radna dana na teritoriji Srbije", order: 8, isActive: true },
    ],
  });
  console.log("  Ticker messages created");

  // ===========================================================================
  // NEWSLETTER SUBSCRIBERS
  // ===========================================================================
  const newsletterEmails = [
    "marija@gmail.com", "stefan@yahoo.com", "ivana@hotmail.com",
    "petar@gmail.com", "milica@outlook.com", "filip@gmail.com",
    "katarina@yahoo.com", "lazar@gmail.com", "teodora@outlook.com",
    "aleksa@gmail.com",
  ];
  for (const email of newsletterEmails) {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {},
      create: { email, active: true },
    });
  }
  console.log("  Newsletter subscribers created");

  // ===========================================================================
  // CHAT FAQ
  // ===========================================================================
  const faqData = [
    { question: "Koliko traje dostava?", answer: "Dostava na teritoriji Srbije traje 2-3 radna dana. Za Beograd je moguća dostava sledećeg radnog dana.", category: "Dostava", sortOrder: 1 },
    { question: "Kako mogu da pratim svoju porudžbinu?", answer: "Nakon slanja paketa dobićete email sa brojem za praćenje. Pratite status na stranici kurirske službe.", category: "Dostava", sortOrder: 2 },
    { question: "Da li mogu da vratim proizvod?", answer: "Da, imate pravo na zamenu ili povraćaj u roku od 14 dana od prijema pošiljke. Proizvod mora biti nekorišćen i u originalnom pakovanju.", category: "Povraćaj", sortOrder: 3 },
    { question: "Koji načini plaćanja su dostupni?", answer: "Možete platiti platnom karticom (Visa, Mastercard) ili pouzećem (gotovinom kuriru pri preuzimanju).", category: "Plaćanje", sortOrder: 4 },
    { question: "Da li je besplatna dostava?", answer: "Dostava je besplatna za sve porudžbine čija vrednost prelazi 5.000 RSD. Za manje porudžbine, dostava košta 390 RSD.", category: "Dostava", sortOrder: 5 },
  ];
  for (const faq of faqData) {
    const existing = await prisma.chatFAQ.findFirst({ where: { question: faq.question } });
    if (!existing) {
      await prisma.chatFAQ.create({ data: { ...faq, active: true } });
    }
  }
  console.log("  Chat FAQ created");

  // ===========================================================================
  // SIZE TABLE (for shoes)
  // ===========================================================================
  const sizeTableExists = await prisma.sizeTable.findUnique({ where: { brandName: "General" } });
  if (!sizeTableExists) {
    await prisma.sizeTable.create({
      data: {
        brandName: "General",
        sizes: [
          { size: 36, length: "22.5 cm" }, { size: 37, length: "23.0 cm" },
          { size: 38, length: "23.5 cm" }, { size: 39, length: "24.5 cm" },
          { size: 40, length: "25.0 cm" }, { size: 41, length: "26.0 cm" },
          { size: 42, length: "26.5 cm" }, { size: 43, length: "27.5 cm" },
          { size: 44, length: "28.0 cm" }, { size: 45, length: "29.0 cm" },
        ],
      },
    });
  }
  console.log("  Size table created");

  // ===========================================================================
  // WISHLIST (for Jelena)
  // ===========================================================================
  const wishlistProducts = ["minimal-white-edition", "kozna-biker-jakna", "kozna-tote-torba", "luxury-rose-gold-sat"];
  for (const slug of wishlistProducts) {
    const pid = productIds[slug];
    if (!pid) continue;
    await prisma.wishlist.upsert({
      where: { userId_productId: { userId: userIds["jelena@demo.rs"], productId: pid } },
      update: {},
      create: { userId: userIds["jelena@demo.rs"], productId: pid },
    });
  }
  console.log("  Wishlist items created");

  // ===========================================================================
  // DONE
  // ===========================================================================
  console.log("\n========================================");
  console.log("  Demo seed completed successfully!");
  console.log("========================================");
  console.log("\nDemo accounts:");
  console.log("  Admin:    admin@demo.rs    / Demo1234!");
  console.log("  Operator: operator@demo.rs / Demo1234!");
  console.log("  Customer: marko@demo.rs    / Demo1234!");
  console.log("  Customer: jelena@demo.rs   / Demo1234!");
  console.log("  Customer: nikola@demo.rs   / Demo1234!");
  console.log("\nData created:");
  console.log("  - 30 products across 5+ categories");
  console.log("  - 6 brands");
  console.log("  - 5 users (admin, operator, 3 customers)");
  console.log("  - 12 orders (various statuses)");
  console.log("  - 20 reviews");
  console.log("  - 4 promotions/coupons");
  console.log("  - 4 hero banners");
  console.log("  - 3 blog articles");
  console.log("  - 9 ticker messages (5 demo naloga + 4 promo)");
  console.log("  - 10 newsletter subscribers");
  console.log("  - 5 FAQ entries");
  console.log("  - Wishlist items");
  console.log("  - Shoe size table\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
