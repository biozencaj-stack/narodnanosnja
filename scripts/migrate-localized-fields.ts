/**
 * Migration script: Convert text fields to localized Json { sr, en }
 * Run with: npx tsx scripts/migrate-localized-fields.ts
 *
 * This script runs the SQL migration for Banner, TickerMessage, Product,
 * Category, Brand, and User.preferredLocale. Run once when upgrading to i18n.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT NOT NULL DEFAULT 'sr'`,
  `ALTER TABLE "Banner" ALTER COLUMN "title" TYPE jsonb USING jsonb_build_object('sr', "title", 'en', '')`,
  `ALTER TABLE "Banner" ALTER COLUMN "subtitle" TYPE jsonb USING CASE WHEN "subtitle" IS NOT NULL THEN jsonb_build_object('sr', "subtitle", 'en', '') ELSE NULL END`,
  `ALTER TABLE "Banner" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END`,
  `ALTER TABLE "Banner" ALTER COLUMN "buttonText" TYPE jsonb USING CASE WHEN "buttonText" IS NOT NULL THEN jsonb_build_object('sr', "buttonText", 'en', '') ELSE NULL END`,
  `ALTER TABLE "TickerMessage" ALTER COLUMN "text" TYPE jsonb USING jsonb_build_object('sr', "text", 'en', '')`,
  `ALTER TABLE "Product" ALTER COLUMN "name" TYPE jsonb USING jsonb_build_object('sr', "name", 'en', '')`,
  `ALTER TABLE "Product" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END`,
  `ALTER TABLE "Product" ALTER COLUMN "metaTitle" TYPE jsonb USING CASE WHEN "metaTitle" IS NOT NULL THEN jsonb_build_object('sr', "metaTitle", 'en', '') ELSE NULL END`,
  `ALTER TABLE "Product" ALTER COLUMN "metaDescription" TYPE jsonb USING CASE WHEN "metaDescription" IS NOT NULL THEN jsonb_build_object('sr', "metaDescription", 'en', '') ELSE NULL END`,
  `ALTER TABLE "Product" ALTER COLUMN "careInstructions" TYPE jsonb USING CASE WHEN "careInstructions" IS NOT NULL THEN jsonb_build_object('sr', "careInstructions", 'en', '') ELSE NULL END`,
  `ALTER TABLE "Category" ALTER COLUMN "name" TYPE jsonb USING jsonb_build_object('sr', "name", 'en', '')`,
  `ALTER TABLE "Category" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END`,
  `ALTER TABLE "Brand" ALTER COLUMN "name" TYPE jsonb USING jsonb_build_object('sr', "name", 'en', '')`,
  `ALTER TABLE "Brand" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END`,
];

async function main() {
  console.log('Running localized fields migration...');
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('OK:', stmt.substring(0, 70) + '...');
    } catch (err) {
      console.error('Error executing:', stmt.substring(0, 80));
      throw err;
    }
  }
  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
