-- Fail-closed, aggregate-only gate for the authoritative-session expand.
-- Run this before 20260830030000_expand_authoritative_sessions, for example:
--   psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f scripts/auth-session-expand-preflight.sql
--
-- The default target is public."Session". session_schema exists only so the
-- isolated real-PostgreSQL fixture can exercise this exact script; psql quotes
-- it as an identifier and production invocations should leave it unset.
-- Output is exactly category|count. It deliberately never prints a token,
-- row ID, user ID, email or timestamp. A nonzero aggregate raises a sanitized
-- SQL error, which makes psql with ON_ERROR_STOP exit with status 3.
\set ON_ERROR_STOP on
\set QUIET 1
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\pset pager off

\if :{?session_schema}
\else
  \set session_schema public
\endif

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '90s';
SET LOCAL TIME ZONE 'UTC';

SELECT pg_catalog.set_config(
  'app.auth_session_expand_preflight_schema',
  :'session_schema',
  true
) \g /dev/null

DO $schema_check$
DECLARE
  target_schema text;
  target_relation regclass;
  has_valid_contract boolean;
BEGIN
  target_schema := current_setting(
    'app.auth_session_expand_preflight_schema',
    true
  );
  target_relation := to_regclass(
    format('%I.%I', target_schema, 'Session')
  );

  IF target_relation IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_class AS relation
       WHERE relation.oid = target_relation
         AND relation.relkind = 'r'
     ) THEN
    RAISE EXCEPTION 'Auth session expand preflight Session contract is unavailable';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns AS column_contract
    WHERE column_contract.table_schema = target_schema
      AND column_contract.table_name = 'Session'
      AND column_contract.column_name = 'sessionToken'
      AND column_contract.data_type = 'text'
      AND column_contract.udt_schema = 'pg_catalog'
      AND column_contract.udt_name = 'text'
      AND column_contract.is_nullable = 'NO'
      AND column_contract.column_default IS NULL
  )
  INTO has_valid_contract;

  IF NOT has_valid_contract
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_index AS catalog_index
       JOIN pg_catalog.pg_attribute AS indexed_column
         ON indexed_column.attrelid = catalog_index.indrelid
        AND indexed_column.attnum = catalog_index.indkey[0]
       WHERE catalog_index.indrelid = target_relation
         AND catalog_index.indisunique
         AND catalog_index.indisvalid
         AND catalog_index.indisready
         AND catalog_index.indnkeyatts = 1
         AND catalog_index.indnatts = 1
         AND indexed_column.attname = 'sessionToken'
         AND catalog_index.indpred IS NULL
         AND catalog_index.indexprs IS NULL
     ) THEN
    RAISE EXCEPTION 'Auth session expand preflight Session contract is unavailable';
  END IF;

  EXECUTE format(
    'LOCK TABLE %I.%I IN ACCESS SHARE MODE',
    target_schema,
    'Session'
  );
END;
$schema_check$;

WITH reserved_legacy_tokens AS MATERIALIZED (
  SELECT count(*)::bigint AS finding_count
  FROM :"session_schema"."Session"
  WHERE "sessionToken" COLLATE "C" ~ '^v1:[0-9a-f]{64}$'
), recorded_result AS MATERIALIZED (
  SELECT set_config(
    'app.auth_session_expand_preflight_ready',
    CASE WHEN finding_count = 0 THEN '1' ELSE '0' END,
    true
  )
  FROM reserved_legacy_tokens
)
SELECT 'preflight.session.legacy_reserved_v1_token', finding_count
FROM reserved_legacy_tokens
CROSS JOIN recorded_result;

DO $result$
BEGIN
  IF current_setting(
    'app.auth_session_expand_preflight_ready',
    true
  ) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Auth session expand preflight found reserved legacy Session token shape';
  END IF;
END;
$result$;

ROLLBACK;
