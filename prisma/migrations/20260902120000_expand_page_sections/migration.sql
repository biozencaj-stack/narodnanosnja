-- Kompatibilan expand za sekcije stranica.
--
-- Samo CREATE TABLE, CREATE INDEX i ADD CONSTRAINT CHECK. Nijedan ALTER nad
-- postojećom tabelom, nijedan DML, nijedan DROP. Zbog toga je povratak koda na
-- prethodnu verziju bezbedan: stariji kod ove tabele jednostavno ne dodiruje.
--
-- Ova migracija je DEVETA u lancu i primenjuje se TEK POSLE četiri auth expand
-- migracije (20260830000000, 20260830010000, 20260830020000, 20260830030000).
-- Redosled je obavezan i zapisan u docs/V2-ROLL-OUT.md. Produkcija je u ovom
-- preseku i dalje na prve četiri migracije.
--
-- `search_path` je namerno `pg_catalog, public`, obrnuto od
-- 20260829020000_expand_v2_platform koja koristi `public, pg_catalog`. Tako
-- korisnički objekat u `public` ne može da zaseni sistemsku funkciju tokom
-- migracije. Razlika je namerna, nije previd.
--
-- GRANT nije ovde. Nijedna postojeća migracija nema GRANT, a aplikaciona rola
-- je u trenutnoj postavci vlasnik baze, pa bi bio no-op. Piše se kao imenovan
-- korak u docs/V2-ROLL-OUT.md, za slučaj da migraciju ikad primeni druga rola.

BEGIN;

SET LOCAL search_path = pg_catalog, public;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

CREATE TABLE public."PageSection" (
  "id"            TEXT NOT NULL,
  "pageKey"       TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "order"         INTEGER NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "config"        JSONB NOT NULL,
  "draftConfig"   JSONB,
  "draftOrder"    INTEGER,
  "draftIsActive" BOOLEAN,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "version"       INTEGER NOT NULL DEFAULT 0,
  "publishedAt"   TIMESTAMP(3),
  "updatedById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public."MediaAsset" (
  "id"          TEXT NOT NULL,
  "path"        TEXT NOT NULL,
  "folder"      TEXT NOT NULL,
  "mimeType"    TEXT NOT NULL,
  "width"       INTEGER NOT NULL,
  "height"      INTEGER NOT NULL,
  "bytes"       INTEGER NOT NULL,
  "alt"         JSONB,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public."MediaAssetUsage" (
  "id"        TEXT NOT NULL,
  "assetId"   TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "polje"     TEXT NOT NULL,

  CONSTRAINT "MediaAssetUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_path_key"
  ON public."MediaAsset" ("path");

CREATE INDEX "PageSection_pageKey_isActive_order_idx"
  ON public."PageSection" ("pageKey", "isActive", "order");

CREATE INDEX "PageSection_kind_idx"
  ON public."PageSection" ("kind");

CREATE INDEX "MediaAsset_folder_createdAt_idx"
  ON public."MediaAsset" ("folder", "createdAt");

CREATE UNIQUE INDEX "MediaAssetUsage_sectionId_polje_key"
  ON public."MediaAssetUsage" ("sectionId", "polje");

CREATE INDEX "MediaAssetUsage_assetId_idx"
  ON public."MediaAssetUsage" ("assetId");

ALTER TABLE public."MediaAssetUsage"
  ADD CONSTRAINT "MediaAssetUsage_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES public."MediaAsset" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."MediaAssetUsage"
  ADD CONSTRAINT "MediaAssetUsage_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES public."PageSection" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Jedino što baza može da proveri nad Json konfiguracijom. Oblik same
-- konfiguracije proverava registar u aplikaciji; ovde stoje invarijante koje
-- ne smeju da zavise od ispravnosti aplikacije.

ALTER TABLE public."PageSection"
  ADD CONSTRAINT "PageSection_order_nonnegative_check"
  CHECK ("order" >= 0);

ALTER TABLE public."PageSection"
  ADD CONSTRAINT "PageSection_version_nonnegative_check"
  CHECK ("version" >= 0);

ALTER TABLE public."PageSection"
  ADD CONSTRAINT "PageSection_draft_order_check"
  CHECK ("draftOrder" IS NULL OR "draftOrder" >= 0);

-- Regex, a ne zatvorena IN lista: lista bi tražila novu migraciju za svaku novu
-- stranicu i time protivrečila razlogu zbog kog je konfiguracija Json.
-- Dvotačka se ne dozvoljava dok odluka o dometu ne bude doneta.
ALTER TABLE public."PageSection"
  ADD CONSTRAINT "PageSection_pageKey_format_check"
  CHECK ("pageKey" ~ '^[a-z][a-z0-9_-]{0,63}$');

ALTER TABLE public."PageSection"
  ADD CONSTRAINT "PageSection_kind_format_check"
  CHECK ("kind" ~ '^[a-z][a-zA-Z0-9]{0,39}$');

ALTER TABLE public."PageSection"
  ADD CONSTRAINT "PageSection_config_object_check"
  CHECK (jsonb_typeof("config") = 'object');

ALTER TABLE public."PageSection"
  ADD CONSTRAINT "PageSection_draft_object_check"
  CHECK ("draftConfig" IS NULL OR jsonb_typeof("draftConfig") = 'object');

-- Prvi znak imena fajla mora biti alfanumerik, pa `.` i `..` ne mogu proći.
ALTER TABLE public."MediaAsset"
  ADD CONSTRAINT "MediaAsset_path_format_check"
  CHECK ("path" ~ '^/uploads/[a-z0-9-]{1,32}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$');

ALTER TABLE public."MediaAsset"
  ADD CONSTRAINT "MediaAsset_dimensions_check"
  CHECK ("width" > 0 AND "height" > 0 AND "bytes" > 0);

COMMIT;
