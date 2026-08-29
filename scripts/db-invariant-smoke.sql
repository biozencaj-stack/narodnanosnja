-- Pozvati nad bazom na kojoj su primenjene V2 expand migracije, na primer:
-- psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/db-invariant-smoke.sql
-- Sve fixture vrednosti postoje samo unutar ove transakcije i uvek se vraćaju.

BEGIN;
SET LOCAL search_path = public, pg_catalog;

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
