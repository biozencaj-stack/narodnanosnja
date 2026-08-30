-- Pozvati nad bazom na kojoj su primenjene V2 expand migracije, na primer:
-- psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/db-invariant-smoke.sql
-- Sve fixture vrednosti postoje samo unutar ove transakcije i uvek se vraćaju.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

-- Verification-email throttle expand: nullable/no-default preserves legacy
-- users and old application compatibility. Equality access continues through
-- User.id, so dedicated throttle indexes would only add write overhead.
DO $$
BEGIN
  IF (
    SELECT "is_nullable"
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" = 'User'
      AND "column_name" = 'verificationEmailNextAllowedAt'
  ) IS DISTINCT FROM 'YES'
     OR (
       SELECT "data_type"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailNextAllowedAt'
     ) IS DISTINCT FROM 'timestamp without time zone'
     OR (
       SELECT "datetime_precision"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailNextAllowedAt'
     ) IS DISTINCT FROM 3
     OR (
       SELECT "column_default"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailNextAllowedAt'
     ) IS NOT NULL THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: verification email cooldown column contract is invalid';
  END IF;

  IF (
    SELECT "is_nullable"
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" = 'User'
      AND "column_name" = 'verificationEmailResendWindowStartedAt'
  ) IS DISTINCT FROM 'YES'
     OR (
       SELECT "data_type"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailResendWindowStartedAt'
     ) IS DISTINCT FROM 'timestamp without time zone'
     OR (
       SELECT "datetime_precision"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailResendWindowStartedAt'
     ) IS DISTINCT FROM 3
     OR (
       SELECT "column_default"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailResendWindowStartedAt'
     ) IS NOT NULL THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: verification email resend window column contract is invalid';
  END IF;

  IF (
    SELECT "is_nullable"
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" = 'User'
      AND "column_name" = 'verificationEmailResendCount'
  ) IS DISTINCT FROM 'YES'
     OR (
       SELECT "data_type"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailResendCount'
     ) IS DISTINCT FROM 'integer'
     OR (
       SELECT "column_default"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'verificationEmailResendCount'
     ) IS NOT NULL THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: verification email resend count column contract is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS catalog_index
    JOIN pg_catalog.pg_class AS indexed_table
      ON indexed_table.oid = catalog_index.indrelid
    JOIN pg_catalog.pg_namespace AS table_namespace
      ON table_namespace.oid = indexed_table.relnamespace
    JOIN pg_catalog.pg_attribute AS indexed_column
      ON indexed_column.attrelid = indexed_table.oid
     AND indexed_column.attnum = catalog_index.indkey[0]
    WHERE table_namespace.nspname = 'public'
      AND indexed_table.relname = 'User'
      AND indexed_column.attname IN (
        'verificationEmailNextAllowedAt',
        'verificationEmailResendWindowStartedAt',
        'verificationEmailResendCount'
      )
      AND catalog_index.indnkeyatts = 1
      AND catalog_index.indnatts = 1
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: redundant verification throttle index exists';
  END IF;

  RAISE NOTICE 'PASS: verification email throttle expand contract is valid';
END;
$$;

-- Auth-token compatibility expand: hash columns are nullable while old and
-- new application versions overlap, plaintext indexes remain available, and
-- PasswordReset has at most one row per user.
DO $$
DECLARE
  expected_index RECORD;
BEGIN
  IF (
    SELECT "is_nullable"
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" = 'PasswordReset'
      AND "column_name" = 'token'
  ) IS DISTINCT FROM 'YES'
     OR (
       SELECT "is_nullable"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'PasswordReset'
         AND "column_name" = 'tokenHash'
     ) IS DISTINCT FROM 'YES'
     OR (
       SELECT "is_nullable"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'EmailVerification'
         AND "column_name" = 'token'
     ) IS DISTINCT FROM 'YES'
     OR (
       SELECT "is_nullable"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'EmailVerification'
         AND "column_name" = 'tokenHash'
     ) IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: auth token/tokenHash nullability is invalid';
  END IF;

  FOR expected_index IN
    SELECT *
    FROM (
      VALUES
        ('PasswordReset_tokenHash_key', 'PasswordReset', 'tokenHash', true),
        ('EmailVerification_tokenHash_key', 'EmailVerification', 'tokenHash', true),
        ('PasswordReset_userId_key', 'PasswordReset', 'userId', true),
        ('PasswordReset_token_key', 'PasswordReset', 'token', true),
        ('PasswordReset_token_idx', 'PasswordReset', 'token', false),
        ('EmailVerification_token_key', 'EmailVerification', 'token', true),
        ('EmailVerification_token_idx', 'EmailVerification', 'token', false)
    ) AS required("indexName", "tableName", "columnName", "mustBeUnique")
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index AS catalog_index
      JOIN pg_catalog.pg_class AS indexed_table
        ON indexed_table.oid = catalog_index.indrelid
      JOIN pg_catalog.pg_namespace AS table_namespace
        ON table_namespace.oid = indexed_table.relnamespace
      JOIN pg_catalog.pg_attribute AS indexed_column
        ON indexed_column.attrelid = indexed_table.oid
       AND indexed_column.attnum = catalog_index.indkey[0]
      WHERE catalog_index.indexrelid = to_regclass(
        format('public.%I', expected_index."indexName")
      )
        AND table_namespace.nspname = 'public'
        AND indexed_table.relname = expected_index."tableName"
        AND indexed_column.attname = expected_index."columnName"
        AND NOT indexed_column.attisdropped
        AND catalog_index.indisunique = expected_index."mustBeUnique"
        AND catalog_index.indisvalid
        AND catalog_index.indisready
        AND NOT catalog_index.indnullsnotdistinct
        AND catalog_index.indnkeyatts = 1
        AND catalog_index.indnatts = 1
        AND catalog_index.indpred IS NULL
        AND catalog_index.indexprs IS NULL
    ) THEN
      RAISE EXCEPTION
        'DB invariant smoke failed: index % is missing, invalid, not ready, or has the wrong table/column/uniqueness contract',
        expected_index."indexName";
    END IF;
  END LOOP;

  IF to_regclass('public."PasswordReset_userId_idx"') IS NOT NULL
     OR to_regclass('public."PasswordReset_tokenHash_idx"') IS NOT NULL
     OR to_regclass('public."EmailVerification_tokenHash_idx"') IS NOT NULL THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: redundant auth expand index exists';
  END IF;

  RAISE NOTICE 'PASS: auth token expand catalog contract is valid';
END;
$$;

INSERT INTO "User" (
  "id", "email", "passwordHash", "firstName", "lastName", "updatedAt"
) VALUES
  (
    'codex-smoke-auth-user-a',
    'codex-smoke-auth-a@example.invalid',
    'codex-smoke-password-hash',
    'Codex',
    'Auth A',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-auth-user-b',
    'codex-smoke-auth-b@example.invalid',
    'codex-smoke-password-hash',
    'Codex',
    'Auth B',
    CURRENT_TIMESTAMP
  );

INSERT INTO "PasswordReset" (
  "id", "userId", "token", "tokenHash", "expires"
) VALUES (
  'codex-smoke-password-reset-a',
  'codex-smoke-auth-user-a',
  NULL,
  'v1:' || repeat('a', 64),
  TIMESTAMP '2026-08-31 12:00:00'
);

DO $$
DECLARE
  rejected_user BOOLEAN := false;
  rejected_hash BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PasswordReset" (
      "id", "userId", "token", "tokenHash", "expires"
    ) VALUES (
      'codex-smoke-password-reset-duplicate-user',
      'codex-smoke-auth-user-a',
      'codex-smoke-reset-token-b',
      'v1:' || repeat('b', 64),
      TIMESTAMP '2026-08-31 13:00:00'
    );
  EXCEPTION WHEN unique_violation THEN
    rejected_user := true;
  END;

  BEGIN
    INSERT INTO "PasswordReset" (
      "id", "userId", "token", "tokenHash", "expires"
    ) VALUES (
      'codex-smoke-password-reset-duplicate-hash',
      'codex-smoke-auth-user-b',
      'codex-smoke-reset-token-c',
      'v1:' || repeat('a', 64),
      TIMESTAMP '2026-08-31 13:00:00'
    );
  EXCEPTION WHEN unique_violation THEN
    rejected_hash := true;
  END;

  IF NOT rejected_user OR NOT rejected_hash THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: PasswordReset uniqueness was not enforced';
  END IF;

  RAISE NOTICE 'PASS: PasswordReset userId and tokenHash uniqueness is enforced';
END;
$$;

INSERT INTO "PasswordReset" (
  "id", "userId", "token", "tokenHash", "expires"
) VALUES (
  'codex-smoke-password-reset-plaintext-compatible',
  'codex-smoke-auth-user-b',
  'codex-smoke-reset-token-legacy',
  NULL,
  TIMESTAMP '2026-08-31 14:00:00'
);

INSERT INTO "EmailVerification" (
  "id", "userId", "token", "tokenHash", "expires"
) VALUES
  (
    'codex-smoke-email-verification-a',
    'codex-smoke-auth-user-a',
    NULL,
    'v1:' || repeat('c', 64),
    TIMESTAMP '2026-08-31 12:00:00'
  ),
  (
    'codex-smoke-email-verification-sibling',
    'codex-smoke-auth-user-a',
    NULL,
    'v1:' || repeat('d', 64),
    TIMESTAMP '2026-08-31 13:00:00'
  );

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "EmailVerification" (
      "id", "userId", "token", "tokenHash", "expires"
    ) VALUES (
      'codex-smoke-email-verification-duplicate-hash',
      'codex-smoke-auth-user-b',
      'codex-smoke-verification-token',
      'v1:' || repeat('c', 64),
      TIMESTAMP '2026-08-31 14:00:00'
    );
  EXCEPTION WHEN unique_violation THEN
    rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: duplicate EmailVerification.tokenHash was accepted';
  END IF;

  RAISE NOTICE 'PASS: EmailVerification hash uniqueness and sibling rows are valid';
END;
$$;

INSERT INTO "EmailVerification" (
  "id", "userId", "token", "tokenHash", "expires"
) VALUES (
  'codex-smoke-email-verification-plaintext-compatible',
  'codex-smoke-auth-user-b',
  'codex-smoke-verification-token-legacy',
  NULL,
  TIMESTAMP '2026-08-31 15:00:00'
);

INSERT INTO "ProductType" (
  "id",
  "code",
  "name",
  "updatedAt"
) VALUES (
  'codex-smoke-product-type',
  'codex-smoke-type',
  '{"sr":"Codex smoke tip","en":"Codex smoke type"}'::jsonb,
  CURRENT_TIMESTAMP
);

INSERT INTO "Product" (
  "id",
  "name",
  "slug",
  "price",
  "tags",
  "productTypeId",
  "active",
  "updatedAt"
) VALUES
  (
    'codex-smoke-product',
    '{"sr":"Codex smoke proizvod","en":"Codex smoke product"}'::jsonb,
    'codex-smoke-product',
    100.00,
    ARRAY['codex-smoke']::text[],
    'codex-smoke-product-type',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-negative-product',
    '{"sr":"Codex negativni fixture","en":"Codex negative fixture"}'::jsonb,
    'codex-smoke-negative-product',
    100.00,
    ARRAY['codex-smoke']::text[],
    'codex-smoke-product-type',
    false,
    CURRENT_TIMESTAMP
  );

INSERT INTO "AttributeDefinition" (
  "id",
  "code",
  "name",
  "dataType",
  "updatedAt"
) VALUES
  (
    'codex-smoke-attr-text',
    'codex-smoke-text',
    '{"sr":"Tekst","en":"Text"}'::jsonb,
    'TEXT',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-rich-text',
    'codex-smoke-rich-text',
    '{"sr":"Obogaćen tekst","en":"Rich text"}'::jsonb,
    'RICH_TEXT',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-integer',
    'codex-smoke-integer',
    '{"sr":"Ceo broj","en":"Integer"}'::jsonb,
    'INTEGER',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-decimal',
    'codex-smoke-decimal',
    '{"sr":"Decimalni broj","en":"Decimal"}'::jsonb,
    'DECIMAL',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-boolean',
    'codex-smoke-boolean',
    '{"sr":"Logička vrednost","en":"Boolean"}'::jsonb,
    'BOOLEAN',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-date',
    'codex-smoke-date',
    '{"sr":"Datum","en":"Date"}'::jsonb,
    'DATE',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-datetime',
    'codex-smoke-datetime',
    '{"sr":"Datum i vreme","en":"Date and time"}'::jsonb,
    'DATETIME',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-select',
    'codex-smoke-select',
    '{"sr":"Jedan izbor","en":"Single select"}'::jsonb,
    'SELECT',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-multi-select',
    'codex-smoke-multi-select',
    '{"sr":"Više izbora","en":"Multi select"}'::jsonb,
    'MULTI_SELECT',
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-attr-json',
    'codex-smoke-json',
    '{"sr":"JSON vrednost","en":"JSON value"}'::jsonb,
    'JSON',
    CURRENT_TIMESTAMP
  );

INSERT INTO "ProductTypeAttribute" (
  "productTypeId",
  "attributeDefinitionId",
  "sortOrder"
) VALUES
  ('codex-smoke-product-type', 'codex-smoke-attr-text', 0),
  ('codex-smoke-product-type', 'codex-smoke-attr-rich-text', 1),
  ('codex-smoke-product-type', 'codex-smoke-attr-integer', 2),
  ('codex-smoke-product-type', 'codex-smoke-attr-decimal', 3),
  ('codex-smoke-product-type', 'codex-smoke-attr-boolean', 4),
  ('codex-smoke-product-type', 'codex-smoke-attr-date', 5),
  ('codex-smoke-product-type', 'codex-smoke-attr-datetime', 6),
  ('codex-smoke-product-type', 'codex-smoke-attr-select', 7),
  ('codex-smoke-product-type', 'codex-smoke-attr-multi-select', 8),
  ('codex-smoke-product-type', 'codex-smoke-attr-json', 9);

INSERT INTO "AttributeChoice" (
  "id",
  "attributeDefinitionId",
  "dataType",
  "code",
  "label",
  "sortOrder",
  "updatedAt"
) VALUES
  (
    'codex-smoke-choice-select-one',
    'codex-smoke-attr-select',
    'SELECT',
    'codex-smoke-select-one',
    '{"sr":"Prvi izbor","en":"First choice"}'::jsonb,
    0,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-choice-select-two',
    'codex-smoke-attr-select',
    'SELECT',
    'codex-smoke-select-two',
    '{"sr":"Drugi izbor","en":"Second choice"}'::jsonb,
    1,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-choice-multi-one',
    'codex-smoke-attr-multi-select',
    'MULTI_SELECT',
    'codex-smoke-multi-one',
    '{"sr":"Prvi višestruki izbor","en":"First multi choice"}'::jsonb,
    0,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-choice-multi-two',
    'codex-smoke-attr-multi-select',
    'MULTI_SELECT',
    'codex-smoke-multi-two',
    '{"sr":"Drugi višestruki izbor","en":"Second multi choice"}'::jsonb,
    1,
    CURRENT_TIMESTAMP
  );

INSERT INTO "ProductAttributeValue" (
  "id",
  "productId",
  "attributeDefinitionId",
  "dataType",
  "valueText",
  "valueInteger",
  "valueDecimal",
  "valueBoolean",
  "valueDate",
  "valueJson",
  "updatedAt"
) VALUES
  (
    'codex-smoke-value-text',
    'codex-smoke-product',
    'codex-smoke-attr-text',
    'TEXT',
    '{"sr":"Pamuk","en":"Cotton"}'::jsonb,
    NULL, NULL, NULL, NULL, NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-rich-text',
    'codex-smoke-product',
    'codex-smoke-attr-rich-text',
    'RICH_TEXT',
    '{"sr":"<p>Opis</p>","en":"<p>Description</p>"}'::jsonb,
    NULL, NULL, NULL, NULL, NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-integer',
    'codex-smoke-product',
    'codex-smoke-attr-integer',
    'INTEGER',
    NULL, 42, NULL, NULL, NULL, NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-decimal',
    'codex-smoke-product',
    'codex-smoke-attr-decimal',
    'DECIMAL',
    NULL, NULL, 123.456789, NULL, NULL, NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-boolean',
    'codex-smoke-product',
    'codex-smoke-attr-boolean',
    'BOOLEAN',
    NULL, NULL, NULL, true, NULL, NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-date',
    'codex-smoke-product',
    'codex-smoke-attr-date',
    'DATE',
    NULL, NULL, NULL, NULL, TIMESTAMP '2026-08-29 00:00:00', NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-datetime',
    'codex-smoke-product',
    'codex-smoke-attr-datetime',
    'DATETIME',
    NULL, NULL, NULL, NULL, TIMESTAMP '2026-08-29 12:34:56', NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-select',
    'codex-smoke-product',
    'codex-smoke-attr-select',
    'SELECT',
    NULL, NULL, NULL, NULL, NULL, NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-multi-select',
    'codex-smoke-product',
    'codex-smoke-attr-multi-select',
    'MULTI_SELECT',
    NULL, NULL, NULL, NULL, NULL, NULL,
    CURRENT_TIMESTAMP
  ),
  (
    'codex-smoke-value-json',
    'codex-smoke-product',
    'codex-smoke-attr-json',
    'JSON',
    NULL, NULL, NULL, NULL, NULL,
    '{"key":"value","nested":{"valid":true}}'::jsonb,
    CURRENT_TIMESTAMP
  );

INSERT INTO "ProductAttributeSelectedChoice" (
  "productAttributeValueId",
  "attributeDefinitionId",
  "attributeChoiceId",
  "sortOrder"
) VALUES
  (
    'codex-smoke-value-select',
    'codex-smoke-attr-select',
    'codex-smoke-choice-select-one',
    0
  ),
  (
    'codex-smoke-value-multi-select',
    'codex-smoke-attr-multi-select',
    'codex-smoke-choice-multi-one',
    0
  ),
  (
    'codex-smoke-value-multi-select',
    'codex-smoke-attr-multi-select',
    'codex-smoke-choice-multi-two',
    1
  );

-- Pokreće deferred cardinality triggere pre rollback-a. Ako bilo koja validna
-- fixture vrednost krši DB invarijantu, skripta se prekida na ovoj naredbi.
SET CONSTRAINTS ALL IMMEDIATE;

DO $$
DECLARE
  value_count INTEGER;
  selected_count INTEGER;
BEGIN
  SELECT count(*)
  INTO value_count
  FROM "ProductAttributeValue"
  WHERE "id" LIKE 'codex-smoke-value-%';

  SELECT count(*)
  INTO selected_count
  FROM "ProductAttributeSelectedChoice"
  WHERE "productAttributeValueId" LIKE 'codex-smoke-value-%';

  IF value_count <> 10 THEN
    RAISE EXCEPTION 'Expected 10 smoke attribute values, found %', value_count;
  END IF;

  IF selected_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 smoke selected choices, found %', selected_count;
  END IF;
END;
$$;

-- Svaki negativni scenario radi u PL/pgSQL exception subtransakciji. Ako DB
-- očekivanu zabranu ne aktivira, spoljašnji RAISE prekida smoke test. Očekivani
-- insert/FK/check error vraća samo taj scenario, bez zagađivanja fixture-a.

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "ProductAttributeValue" (
      "id",
      "productId",
      "attributeDefinitionId",
      "dataType",
      "valueText",
      "updatedAt"
    ) VALUES (
      'codex-smoke-negative-wrong-scalar',
      'codex-smoke-negative-product',
      'codex-smoke-attr-integer',
      'INTEGER',
      '{"sr":"pogrešna kolona","en":"wrong column"}'::jsonb,
      CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: INTEGER value with valueText was accepted';
  END IF;

  RAISE NOTICE 'PASS: wrong scalar column was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    SET CONSTRAINTS
      "ProductAttributeValue_choice_cardinality_trigger",
      "ProductAttributeSelectedChoice_cardinality_trigger"
      DEFERRED;

    INSERT INTO "ProductAttributeValue" (
      "id",
      "productId",
      "attributeDefinitionId",
      "dataType",
      "updatedAt"
    ) VALUES (
      'codex-smoke-negative-select-zero',
      'codex-smoke-negative-product',
      'codex-smoke-attr-select',
      'SELECT',
      CURRENT_TIMESTAMP
    );

    SET CONSTRAINTS
      "ProductAttributeValue_choice_cardinality_trigger",
      "ProductAttributeSelectedChoice_cardinality_trigger"
      IMMEDIATE;
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: SELECT value with zero choices was accepted';
  END IF;

  RAISE NOTICE 'PASS: SELECT with zero choices was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    SET CONSTRAINTS
      "ProductAttributeValue_choice_cardinality_trigger",
      "ProductAttributeSelectedChoice_cardinality_trigger"
      DEFERRED;

    INSERT INTO "ProductAttributeValue" (
      "id",
      "productId",
      "attributeDefinitionId",
      "dataType",
      "updatedAt"
    ) VALUES (
      'codex-smoke-negative-select-two',
      'codex-smoke-negative-product',
      'codex-smoke-attr-select',
      'SELECT',
      CURRENT_TIMESTAMP
    );

    INSERT INTO "ProductAttributeSelectedChoice" (
      "productAttributeValueId",
      "attributeDefinitionId",
      "attributeChoiceId",
      "sortOrder"
    ) VALUES
      (
        'codex-smoke-negative-select-two',
        'codex-smoke-attr-select',
        'codex-smoke-choice-select-one',
        0
      ),
      (
        'codex-smoke-negative-select-two',
        'codex-smoke-attr-select',
        'codex-smoke-choice-select-two',
        1
      );

    SET CONSTRAINTS
      "ProductAttributeValue_choice_cardinality_trigger",
      "ProductAttributeSelectedChoice_cardinality_trigger"
      IMMEDIATE;
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: SELECT value with two choices was accepted';
  END IF;

  RAISE NOTICE 'PASS: SELECT with two choices was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    SET CONSTRAINTS
      "ProductAttributeValue_choice_cardinality_trigger",
      "ProductAttributeSelectedChoice_cardinality_trigger"
      DEFERRED;

    INSERT INTO "ProductAttributeValue" (
      "id",
      "productId",
      "attributeDefinitionId",
      "dataType",
      "updatedAt"
    ) VALUES (
      'codex-smoke-negative-wrong-choice-definition',
      'codex-smoke-negative-product',
      'codex-smoke-attr-select',
      'SELECT',
      CURRENT_TIMESTAMP
    );

    INSERT INTO "ProductAttributeSelectedChoice" (
      "productAttributeValueId",
      "attributeDefinitionId",
      "attributeChoiceId",
      "sortOrder"
    ) VALUES (
      'codex-smoke-negative-wrong-choice-definition',
      'codex-smoke-attr-select',
      'codex-smoke-choice-multi-one',
      0
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: choice from another definition was accepted';
  END IF;

  RAISE NOTICE 'PASS: choice from another definition was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "ProductSize" (
      "id",
      "productId",
      "size",
      "stock",
      "active"
    ) VALUES (
      'codex-smoke-negative-stock',
      'codex-smoke-negative-product',
      'negative-stock',
      -1,
      true
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: negative ProductSize stock was accepted';
  END IF;

  RAISE NOTICE 'PASS: negative ProductSize stock was rejected';
END;
$$;

SET CONSTRAINTS ALL IMMEDIATE;

ROLLBACK;
