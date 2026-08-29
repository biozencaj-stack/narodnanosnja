#!/usr/bin/env npx tsx
/**
 * Download curated demo images from Unsplash for the demo webshop.
 * Uses Unsplash Source (no API key required) with specific photo IDs.
 *
 * Usage: npx tsx scripts/download-demo-images.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const PUBLIC_DIR = path.join(process.cwd(), "public");

interface ImageEntry {
  filename: string;
  folder: string;
  url: string;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (reqUrl: string) => {
      https
        .get(reqUrl, { headers: { "User-Agent": "DemoImageDownloader/1.0" } }, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              request(redirectUrl);
              return;
            }
          }
          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(dest);
            reject(new Error(`HTTP ${response.statusCode} for ${reqUrl}`));
            return;
          }
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        })
        .on("error", (err) => {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(err);
        });
    };
    request(url);
  });
}

// Curated Unsplash photo IDs for each category
// Using https://images.unsplash.com/photo-{id}?w={width}&q=80&fit=crop
const unsplash = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&fit=crop&auto=format`;

// Fallback: picsum.photos with seed for consistency
const picsum = (seed: string, w = 800, h = 800) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const IMAGES: ImageEntry[] = [
  // ============================================================
  // SNEAKERS / PATIKE (8 products x 3 images = 24)
  // ============================================================
  { folder: "products", filename: "patike-urban-runner-1.jpg", url: unsplash("1542291026-7eec264c27ff") },
  { folder: "products", filename: "patike-urban-runner-2.jpg", url: picsum("urban-runner-2") },
  { folder: "products", filename: "patike-urban-runner-3.jpg", url: unsplash("1551107696-a4b0c5a0d9a2") },

  { folder: "products", filename: "patike-sport-boost-1.jpg", url: unsplash("1606107557195-0e29a4b5b4aa") },
  { folder: "products", filename: "patike-sport-boost-2.jpg", url: unsplash("1539185441755-769473a23570") },
  { folder: "products", filename: "patike-sport-boost-3.jpg", url: unsplash("1595950653106-6c9ebd614d3a") },

  { folder: "products", filename: "patike-classic-574-1.jpg", url: picsum("classic-574-1") },
  { folder: "products", filename: "patike-classic-574-2.jpg", url: unsplash("1600185365926-3a2ce3cdb9eb") },
  { folder: "products", filename: "patike-classic-574-3.jpg", url: picsum("classic-574-3") },

  { folder: "products", filename: "patike-retro-90s-1.jpg", url: unsplash("1597045566677-8cf032ed6634") },
  { folder: "products", filename: "patike-retro-90s-2.jpg", url: unsplash("1543508282-6319a3e2621f") },
  { folder: "products", filename: "patike-retro-90s-3.jpg", url: unsplash("1587563871167-1ee9c731aefb") },

  { folder: "products", filename: "patike-air-pro-1.jpg", url: unsplash("1600269452121-4f2416e55c28") },
  { folder: "products", filename: "patike-air-pro-2.jpg", url: unsplash("1556906781-9a412961c28c") },
  { folder: "products", filename: "patike-air-pro-3.jpg", url: unsplash("1491553895911-0055eca6402d") },

  { folder: "products", filename: "patike-street-flex-1.jpg", url: unsplash("1525966222134-fcfa99b8ae77") },
  { folder: "products", filename: "patike-street-flex-2.jpg", url: unsplash("1549298916-b41d501d3772") },
  { folder: "products", filename: "patike-street-flex-3.jpg", url: unsplash("1560769629-975ec94e6a86") },

  { folder: "products", filename: "patike-trail-hiker-1.jpg", url: picsum("trail-hiker-1") },
  { folder: "products", filename: "patike-trail-hiker-2.jpg", url: unsplash("1520256862855-398228c41684") },
  { folder: "products", filename: "patike-trail-hiker-3.jpg", url: unsplash("1603808033192-082d6919d3e1") },

  { folder: "products", filename: "patike-minimal-white-1.jpg", url: unsplash("1595341888016-a392ef81b7de") },
  { folder: "products", filename: "patike-minimal-white-2.jpg", url: picsum("minimal-white-2") },
  { folder: "products", filename: "patike-minimal-white-3.jpg", url: unsplash("1585232004423-244e0e6904e3") },

  // ============================================================
  // JACKETS / JAKNE (5 products x 3 images = 15)
  // ============================================================
  { folder: "products", filename: "jakna-puffer-1.jpg", url: picsum("puffer-jacket-1") },
  { folder: "products", filename: "jakna-puffer-2.jpg", url: unsplash("1551028719-00167b16eac5") },
  { folder: "products", filename: "jakna-puffer-3.jpg", url: unsplash("1559551409-dadc959f76b8") },

  { folder: "products", filename: "jakna-kozna-1.jpg", url: unsplash("1551028719-00167b16eac5") },
  { folder: "products", filename: "jakna-kozna-2.jpg", url: unsplash("1521223890158-f9f7c3d5d504") },
  { folder: "products", filename: "jakna-kozna-3.jpg", url: unsplash("1507679799987-c73779587ccf") },

  { folder: "products", filename: "jakna-denim-1.jpg", url: unsplash("1576995853123-5a10305d93c0") },
  { folder: "products", filename: "jakna-denim-2.jpg", url: unsplash("1548126032-079a0fb0099d") },
  { folder: "products", filename: "jakna-denim-3.jpg", url: unsplash("1591047139829-d91aecb6caea") },

  { folder: "products", filename: "jakna-windbreaker-1.jpg", url: unsplash("1591047139829-d91aecb6caea") },
  { folder: "products", filename: "jakna-windbreaker-2.jpg", url: picsum("windbreaker-2") },
  { folder: "products", filename: "jakna-windbreaker-3.jpg", url: unsplash("1559551409-dadc959f76b8") },

  { folder: "products", filename: "jakna-bomber-1.jpg", url: unsplash("1551028719-00167b16eac5") },
  { folder: "products", filename: "jakna-bomber-2.jpg", url: unsplash("1507679799987-c73779587ccf") },
  { folder: "products", filename: "jakna-bomber-3.jpg", url: unsplash("1521223890158-f9f7c3d5d504") },

  // ============================================================
  // T-SHIRTS / MAJICE (5 products x 3 images = 15)
  // ============================================================
  { folder: "products", filename: "majica-basic-1.jpg", url: unsplash("1521572163474-6864f9cf17ab") },
  { folder: "products", filename: "majica-basic-2.jpg", url: unsplash("1583743814966-8936f5b7be1a") },
  { folder: "products", filename: "majica-basic-3.jpg", url: unsplash("1562157873-818bc0726f68") },

  { folder: "products", filename: "majica-graphic-1.jpg", url: unsplash("1503342217505-b0a15ec3261c") },
  { folder: "products", filename: "majica-graphic-2.jpg", url: unsplash("1576566588028-4147f3842f27") },
  { folder: "products", filename: "majica-graphic-3.jpg", url: unsplash("1529374255404-311a2a4f1fd9") },

  { folder: "products", filename: "majica-polo-1.jpg", url: unsplash("1586790170083-2f9ceadc732d") },
  { folder: "products", filename: "majica-polo-2.jpg", url: unsplash("1618354691373-d851c5c3a990") },
  { folder: "products", filename: "majica-polo-3.jpg", url: unsplash("1581655353564-df123a1eb820") },

  { folder: "products", filename: "majica-henley-1.jpg", url: unsplash("1618354691373-d851c5c3a990") },
  { folder: "products", filename: "majica-henley-2.jpg", url: unsplash("1521572163474-6864f9cf17ab") },
  { folder: "products", filename: "majica-henley-3.jpg", url: unsplash("1583743814966-8936f5b7be1a") },

  { folder: "products", filename: "majica-oversized-1.jpg", url: unsplash("1576566588028-4147f3842f27") },
  { folder: "products", filename: "majica-oversized-2.jpg", url: unsplash("1562157873-818bc0726f68") },
  { folder: "products", filename: "majica-oversized-3.jpg", url: unsplash("1503342217505-b0a15ec3261c") },

  // ============================================================
  // BAGS / TORBE (4 products x 3 images = 12)
  // ============================================================
  { folder: "products", filename: "torba-tote-1.jpg", url: unsplash("1584917865442-de89df76afd3") },
  { folder: "products", filename: "torba-tote-2.jpg", url: picsum("tote-bag-2") },
  { folder: "products", filename: "torba-tote-3.jpg", url: picsum("tote-bag-3") },

  { folder: "products", filename: "torba-backpack-1.jpg", url: unsplash("1553062407-98eeb64c6a62") },
  { folder: "products", filename: "torba-backpack-2.jpg", url: unsplash("1581605405669-fcdf81165afa") },
  { folder: "products", filename: "torba-backpack-3.jpg", url: picsum("backpack-3") },

  { folder: "products", filename: "torba-crossbody-1.jpg", url: picsum("crossbody-1") },
  { folder: "products", filename: "torba-crossbody-2.jpg", url: unsplash("1584917865442-de89df76afd3") },
  { folder: "products", filename: "torba-crossbody-3.jpg", url: picsum("crossbody-3") },

  { folder: "products", filename: "torba-duffle-1.jpg", url: unsplash("1553062407-98eeb64c6a62") },
  { folder: "products", filename: "torba-duffle-2.jpg", url: picsum("duffle-2") },
  { folder: "products", filename: "torba-duffle-3.jpg", url: unsplash("1581605405669-fcdf81165afa") },

  // ============================================================
  // WATCHES / SATOVI (4 products x 3 images = 12)
  // ============================================================
  { folder: "products", filename: "sat-classic-1.jpg", url: unsplash("1524592094714-0f0654e20314") },
  { folder: "products", filename: "sat-classic-2.jpg", url: unsplash("1522312346375-d1a52e2b99b3") },
  { folder: "products", filename: "sat-classic-3.jpg", url: picsum("watch-classic-3") },

  { folder: "products", filename: "sat-smart-1.jpg", url: picsum("smart-watch-1") },
  { folder: "products", filename: "sat-smart-2.jpg", url: unsplash("1579586337278-3befd40fd17a") },
  { folder: "products", filename: "sat-smart-3.jpg", url: picsum("smart-watch-3") },

  { folder: "products", filename: "sat-sport-1.jpg", url: unsplash("1523170335258-f5ed11844a49") },
  { folder: "products", filename: "sat-sport-2.jpg", url: unsplash("1524592094714-0f0654e20314") },
  { folder: "products", filename: "sat-sport-3.jpg", url: unsplash("1522312346375-d1a52e2b99b3") },

  { folder: "products", filename: "sat-luxury-1.jpg", url: picsum("luxury-watch-1") },
  { folder: "products", filename: "sat-luxury-2.jpg", url: picsum("luxury-watch-2") },
  { folder: "products", filename: "sat-luxury-3.jpg", url: unsplash("1523170335258-f5ed11844a49") },

  // ============================================================
  // ACCESSORIES / AKSESORI (4 products x 3 images = 12)
  // ============================================================
  { folder: "products", filename: "aksesoar-sunglasses-1.jpg", url: unsplash("1511499767150-a48a237f0083") },
  { folder: "products", filename: "aksesoar-sunglasses-2.jpg", url: unsplash("1572635196237-14b3f281503f") },
  { folder: "products", filename: "aksesoar-sunglasses-3.jpg", url: unsplash("1473496169904-658ba7c44d8a") },

  { folder: "products", filename: "aksesoar-belt-1.jpg", url: picsum("leather-belt-1") },
  { folder: "products", filename: "aksesoar-belt-2.jpg", url: unsplash("1624222247344-550fb60583dc") },
  { folder: "products", filename: "aksesoar-belt-3.jpg", url: picsum("leather-belt-3") },

  { folder: "products", filename: "aksesoar-wallet-1.jpg", url: unsplash("1627123424574-724758594e93") },
  { folder: "products", filename: "aksesoar-wallet-2.jpg", url: unsplash("1556742049-0cfed4f6a45d") },
  { folder: "products", filename: "aksesoar-wallet-3.jpg", url: unsplash("1627123424574-724758594e93") },

  { folder: "products", filename: "aksesoar-scarf-1.jpg", url: picsum("scarf-wool-1") },
  { folder: "products", filename: "aksesoar-scarf-2.jpg", url: picsum("scarf-wool-2") },
  { folder: "products", filename: "aksesoar-scarf-3.jpg", url: picsum("scarf-wool-3") },

  // ============================================================
  // CATEGORY IMAGES (6)
  // ============================================================
  { folder: "categories", filename: "patike.jpg", url: picsum("cat-sneakers", 1200, 800) },
  { folder: "categories", filename: "jakne.jpg", url: picsum("cat-jackets", 1200, 800) },
  { folder: "categories", filename: "majice.jpg", url: unsplash("1521572163474-6864f9cf17ab", 1200) },
  { folder: "categories", filename: "torbe.jpg", url: unsplash("1553062407-98eeb64c6a62", 1200) },
  { folder: "categories", filename: "satovi.jpg", url: unsplash("1524592094714-0f0654e20314", 1200) },
  { folder: "categories", filename: "aksesori.jpg", url: unsplash("1511499767150-a48a237f0083", 1200) },

  // ============================================================
  // BANNER IMAGES (4) - hero-sized
  // ============================================================
  { folder: "products", filename: "banner-hero-1.jpg", url: unsplash("1441986300917-64674bd600d8", 1920) },
  { folder: "products", filename: "banner-hero-2.jpg", url: unsplash("1483985988355-763728e1935b", 1920) },
  { folder: "products", filename: "banner-hero-3.jpg", url: unsplash("1490481651871-ab68de25d43d", 1920) },
  { folder: "products", filename: "banner-hero-4.jpg", url: unsplash("1445205170230-053b83016050", 1920) },

  // ============================================================
  // ARTICLE IMAGES (3)
  // ============================================================
  { folder: "articles", filename: "nova-kolekcija.jpg", url: unsplash("1483985988355-763728e1935b", 1200) },
  { folder: "articles", filename: "odrzavanje-obuce.jpg", url: picsum("shoe-care", 1200, 800) },
  { folder: "articles", filename: "top-trendovi.jpg", url: unsplash("1441986300917-64674bd600d8", 1200) },
];

async function main() {
  console.log(`\nDownloading ${IMAGES.length} demo images...\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const img of IMAGES) {
    const dir = path.join(PUBLIC_DIR, "uploads", img.folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const dest = path.join(dir, img.filename);

    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`  Downloading ${img.folder}/${img.filename}...`);
      await downloadFile(img.url, dest);

      const stats = fs.statSync(dest);
      if (stats.size < 1000) {
        fs.unlinkSync(dest);
        console.log(" FAILED (too small)");
        failed++;
      } else {
        console.log(` OK (${Math.round(stats.size / 1024)}KB)`);
        success++;
      }
    } catch (err) {
      console.log(` FAILED: ${(err as Error).message}`);
      failed++;
    }

    // Small delay to be polite to Unsplash
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone! Downloaded: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Images saved to: ${path.join(PUBLIC_DIR, "uploads")}\n`);
}

main().catch(console.error);
