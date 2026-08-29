-- Read-only preflight za postojeću legacy bazu PRE V2 expand migracije.
-- Pokretanje:
-- psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/db-legacy-preflight.sql
-- Skripta ne menja šemu ni podatke. Svaki nalaz prekida izvršavanje jasnom
-- porukom; problem se rešava i preflight ponavlja pre maintenance prozora.

BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  violation_count BIGINT;
BEGIN
  SELECT count(*)
  INTO violation_count
  FROM (
    SELECT "productId", "size"
    FROM "ProductSize"
    GROUP BY "productId", "size"
    HAVING count(*) > 1
  ) AS duplicate_exact_sizes;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: ProductSize has % duplicate exact (productId, size) group(s). Deduplicate them before adding the unique index.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM (
    SELECT "productId", lower(btrim("size")) AS normalized_size
    FROM "ProductSize"
    GROUP BY "productId", lower(btrim("size"))
    HAVING count(*) > 1
  ) AS duplicate_normalized_sizes;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: ProductSize has % duplicate lower(trim(size)) group(s). Reconcile case/whitespace variants before migration.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM "ProductSize"
  WHERE btrim("size") = ''
     OR "size" <> btrim("size")
     OR char_length("size") > 100;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: % ProductSize row(s) have blank, untrimmed or longer-than-100 size values.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM "ProductSize"
  WHERE "stock" < 0;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: % ProductSize row(s) have negative stock.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM "Product"
  WHERE "price" < 0
     OR ("salePrice" IS NOT NULL AND "salePrice" < 0)
     OR ("weight" IS NOT NULL AND "weight" < 0)
     OR ("length" IS NOT NULL AND "length" < 0)
     OR ("width" IS NOT NULL AND "width" < 0)
     OR ("height" IS NOT NULL AND "height" < 0);

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: % Product row(s) have negative price, sale price or measurement values.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM "ProductVariant"
  WHERE "stock" < 0
     OR ("price" IS NOT NULL AND "price" < 0);

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: % ProductVariant row(s) have negative stock or price.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM "Order"
  WHERE "subtotal" < 0
     OR "shipping" < 0
     OR "discount" < 0
     OR "total" < 0;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: % Order row(s) have negative subtotal, shipping, discount or total.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM "OrderItem"
  WHERE "quantity" <= 0
     OR "price" < 0;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: % OrderItem row(s) have non-positive quantity or negative price.',
      violation_count;
  END IF;

  SELECT count(*)
  INTO violation_count
  FROM "Product" AS product
  WHERE product."active" = true
    AND NOT EXISTS (
      SELECT 1
      FROM "ProductSize" AS product_size
      WHERE product_size."productId" = product."id"
    );

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Legacy preflight failed: % active Product row(s) have no ProductSize inventory row. Add inventory or deactivate the product.',
      violation_count;
  END IF;

  RAISE NOTICE
    'Legacy preflight passed: ProductSize uniqueness/format, inventory, prices, measurements and order amounts are compatible with V2 expand constraints.';
END;
$$;

ROLLBACK;
