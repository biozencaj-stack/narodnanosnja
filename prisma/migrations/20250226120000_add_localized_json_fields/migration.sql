-- Add preferredLocale to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT NOT NULL DEFAULT 'sr';

-- Banner: convert title, subtitle, description, buttonText to Json (jsonb)
ALTER TABLE "Banner" ALTER COLUMN "title" TYPE jsonb USING jsonb_build_object('sr', "title", 'en', '');
ALTER TABLE "Banner" ALTER COLUMN "subtitle" TYPE jsonb USING CASE WHEN "subtitle" IS NOT NULL THEN jsonb_build_object('sr', "subtitle", 'en', '') ELSE NULL END;
ALTER TABLE "Banner" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END;
ALTER TABLE "Banner" ALTER COLUMN "buttonText" TYPE jsonb USING CASE WHEN "buttonText" IS NOT NULL THEN jsonb_build_object('sr', "buttonText", 'en', '') ELSE NULL END;

-- TickerMessage: convert text to Json (jsonb)
ALTER TABLE "TickerMessage" ALTER COLUMN "text" TYPE jsonb USING jsonb_build_object('sr', "text", 'en', '');

-- Product: convert name, description, metaTitle, metaDescription, careInstructions to Json (jsonb)
ALTER TABLE "Product" ALTER COLUMN "name" TYPE jsonb USING jsonb_build_object('sr', "name", 'en', '');
ALTER TABLE "Product" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END;
ALTER TABLE "Product" ALTER COLUMN "metaTitle" TYPE jsonb USING CASE WHEN "metaTitle" IS NOT NULL THEN jsonb_build_object('sr', "metaTitle", 'en', '') ELSE NULL END;
ALTER TABLE "Product" ALTER COLUMN "metaDescription" TYPE jsonb USING CASE WHEN "metaDescription" IS NOT NULL THEN jsonb_build_object('sr', "metaDescription", 'en', '') ELSE NULL END;
ALTER TABLE "Product" ALTER COLUMN "careInstructions" TYPE jsonb USING CASE WHEN "careInstructions" IS NOT NULL THEN jsonb_build_object('sr', "careInstructions", 'en', '') ELSE NULL END;

-- Category: convert name, description to Json (jsonb)
ALTER TABLE "Category" ALTER COLUMN "name" TYPE jsonb USING jsonb_build_object('sr', "name", 'en', '');
ALTER TABLE "Category" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END;

-- Brand: convert name, description to Json
ALTER TABLE "Brand" ALTER COLUMN "name" TYPE jsonb USING jsonb_build_object('sr', "name", 'en', '');
ALTER TABLE "Brand" ALTER COLUMN "description" TYPE jsonb USING CASE WHEN "description" IS NOT NULL THEN jsonb_build_object('sr', "description", 'en', '') ELSE NULL END;
