-- Pozvati nad bazom na kojoj su primenjene V2 expand migracije, na primer:
-- psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/db-invariant-smoke.sql
-- Sve fixture vrednosti postoje samo unutar ove transakcije i uvek se vraćaju.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

-- Verified-login grace expand: nullable/no-default preserves existing login
-- behaviour until the audited cutoff/backfill and enforcement release. The
-- field is read with User.id/email, so no deadline index is part of the
-- compatibility contract.
DO $$
BEGIN
  IF (
    SELECT "is_nullable"
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" = 'User'
      AND "column_name" = 'emailVerificationLoginGraceUntil'
  ) IS DISTINCT FROM 'YES'
     OR (
       SELECT "data_type"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'emailVerificationLoginGraceUntil'
     ) IS DISTINCT FROM 'timestamp without time zone'
     OR (
       SELECT "datetime_precision"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'emailVerificationLoginGraceUntil'
     ) IS DISTINCT FROM 3
     OR (
       SELECT "column_default"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'emailVerificationLoginGraceUntil'
     ) IS NOT NULL THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: verified-login grace column contract is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS catalog_index
    JOIN pg_catalog.pg_class AS indexed_table
      ON indexed_table.oid = catalog_index.indrelid
    JOIN pg_catalog.pg_namespace AS table_namespace
      ON table_namespace.oid = indexed_table.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND indexed_table.relname = 'User'
      AND position(
        '"emailVerificationLoginGraceUntil"'
        IN pg_catalog.pg_get_indexdef(catalog_index.indexrelid)
      ) > 0
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: redundant verified-login grace index exists';
  END IF;

  RAISE NOTICE 'PASS: verified-login grace expand contract is valid';
END;
$$;

-- Authoritative-session compatibility expand. Legacy Session rows keep all
-- three metadata fields NULL. A V2 row must provide a complete, bounded and
-- digest-only contract, while the singleton policy row is seeded in audit.
DO $$
DECLARE
  required_constraint RECORD;
BEGIN
  IF (
    SELECT "is_nullable"
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" = 'User'
      AND "column_name" = 'authSessionRevision'
  ) IS DISTINCT FROM 'NO'
     OR (
       SELECT "data_type"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'authSessionRevision'
     ) IS DISTINCT FROM 'integer'
     OR (
       SELECT "column_default"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" = 'User'
         AND "column_name" = 'authSessionRevision'
     ) IS NULL THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: User auth session revision contract is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('authSessionRevision', 'integer', NULL::integer),
        ('authPolicyRevision', 'integer', NULL::integer),
        ('issuedAt', 'timestamp without time zone', 3)
    ) AS expected("columnName", "dataType", "precision")
    LEFT JOIN information_schema.columns AS actual
      ON actual."table_schema" = 'public'
     AND actual."table_name" = 'Session'
     AND actual."column_name" = expected."columnName"
    WHERE actual."column_name" IS NULL
       OR actual."is_nullable" IS DISTINCT FROM 'YES'
       OR actual."data_type" IS DISTINCT FROM expected."dataType"
       OR actual."column_default" IS NOT NULL
       OR (
         expected."precision" IS NOT NULL
         AND actual."datetime_precision" IS DISTINCT FROM expected."precision"
       )
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: Session authoritative expand columns are invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('id', 'NO', 'integer', NULL::integer, true),
        ('revision', 'NO', 'integer', NULL::integer, true),
        ('policy', 'NO', 'text', NULL::integer, true),
        (
          'stagedGraceDeadline',
          'YES',
          'timestamp without time zone',
          3,
          false
        ),
        ('createdAt', 'NO', 'timestamp without time zone', 3, true),
        ('updatedAt', 'NO', 'timestamp without time zone', 3, false)
    ) AS expected(
      "columnName",
      "isNullable",
      "dataType",
      "precision",
      "hasDefault"
    )
    LEFT JOIN information_schema.columns AS actual
      ON actual."table_schema" = 'public'
     AND actual."table_name" = 'AuthPolicyState'
     AND actual."column_name" = expected."columnName"
    WHERE actual."column_name" IS NULL
       OR actual."is_nullable" IS DISTINCT FROM expected."isNullable"
       OR actual."data_type" IS DISTINCT FROM expected."dataType"
       OR (
         expected."precision" IS NOT NULL
         AND actual."datetime_precision" IS DISTINCT FROM expected."precision"
       )
       OR (
         expected."hasDefault"
         AND actual."column_default" IS NULL
       )
       OR (
         NOT expected."hasDefault"
         AND actual."column_default" IS NOT NULL
       )
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: AuthPolicyState column contract is invalid';
  END IF;

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
    WHERE catalog_index.indexrelid =
          to_regclass('public."Session_expires_idx"')
      AND table_namespace.nspname = 'public'
      AND indexed_table.relname = 'Session'
      AND indexed_column.attname = 'expires'
      AND catalog_index.indisvalid
      AND catalog_index.indisready
      AND NOT catalog_index.indisunique
      AND catalog_index.indnkeyatts = 1
      AND catalog_index.indnatts = 1
      AND catalog_index.indpred IS NULL
      AND catalog_index.indexprs IS NULL
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: Session expiry index is missing or invalid';
  END IF;

  IF to_regclass('public."AuthPolicyState"') IS NULL
     OR (
       SELECT count(*)
       FROM public."AuthPolicyState"
     ) <> 1
     OR NOT EXISTS (
       SELECT 1
       FROM public."AuthPolicyState"
       WHERE "id" = 1
         AND "revision" = 1
         AND "policy" = 'audit'
         AND "stagedGraceDeadline" IS NULL
         AND pg_catalog.isfinite("createdAt")
         AND pg_catalog.isfinite("updatedAt")
     ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: AuthPolicyState audit singleton is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'AuthPolicyState_pkey'
      AND conrelid = to_regclass('public."AuthPolicyState"')
      AND contype = 'p'
      AND convalidated
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: AuthPolicyState primary key is missing or invalid';
  END IF;

  FOR required_constraint IN
    SELECT *
    FROM (
      VALUES
        ('User_authSessionRevision_nonnegative_check', 'User'),
        ('Session_authoritative_metadata_check', 'Session'),
        ('AuthPolicyState_singleton_check', 'AuthPolicyState'),
        ('AuthPolicyState_revision_check', 'AuthPolicyState'),
        ('AuthPolicyState_policy_check', 'AuthPolicyState'),
        ('AuthPolicyState_deadline_check', 'AuthPolicyState'),
        ('AuthPolicyState_timestamps_check', 'AuthPolicyState')
    ) AS required("constraintName", "tableName")
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint
      WHERE conname = required_constraint."constraintName"
        AND conrelid = to_regclass(
          format('public.%I', required_constraint."tableName")
        )
        AND contype = 'c'
        AND convalidated
    ) THEN
      RAISE EXCEPTION
        'DB invariant smoke failed: constraint % is missing or not valid',
        required_constraint."constraintName";
    END IF;
  END LOOP;

  RAISE NOTICE 'PASS: authoritative session expand catalog contract is valid';
END;
$$;

INSERT INTO "User" (
  "id", "email", "passwordHash", "firstName", "lastName", "updatedAt"
) VALUES (
  'codex-smoke-session-user',
  'codex-smoke-session-user@example.invalid',
  'codex-smoke-password-hash',
  'Codex',
  'Session',
  CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF (
    SELECT "authSessionRevision"
    FROM "User"
    WHERE "id" = 'codex-smoke-session-user'
  ) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: User auth session revision default is not zero';
  END IF;

  RAISE NOTICE 'PASS: User auth session revision default is zero';
END;
$$;

INSERT INTO "Session" (
  "id", "sessionToken", "userId", "expires"
) VALUES (
  'codex-smoke-legacy-session',
  'codex-smoke-legacy-session-token',
  'codex-smoke-session-user',
  TIMESTAMP '2026-08-31 12:00:00'
);

INSERT INTO "Session" (
  "id",
  "sessionToken",
  "userId",
  "expires",
  "authSessionRevision",
  "authPolicyRevision",
  "issuedAt"
) VALUES (
  'codex-smoke-authoritative-session',
  'v1:' || repeat('a', 64),
  'codex-smoke-session-user',
  TIMESTAMP '2026-08-31 12:00:00',
  0,
  1,
  TIMESTAMP '2026-08-30 12:00:00'
);

UPDATE "User"
SET "authSessionRevision" = 2
WHERE "id" = 'codex-smoke-session-user';

INSERT INTO "Session" (
  "id",
  "sessionToken",
  "userId",
  "expires",
  "authSessionRevision",
  "authPolicyRevision",
  "issuedAt"
) VALUES (
  'codex-smoke-authoritative-session-revision',
  'v1:' || repeat('f', 64),
  'codex-smoke-session-user',
  TIMESTAMP '2026-08-31 11:59:59.999',
  2,
  2,
  TIMESTAMP '2026-08-30 12:00:00'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Session"
    WHERE "id" = 'codex-smoke-legacy-session'
      AND "authSessionRevision" IS NULL
      AND "authPolicyRevision" IS NULL
      AND "issuedAt" IS NULL
  )
     OR NOT EXISTS (
       SELECT 1
       FROM "Session"
       WHERE "id" = 'codex-smoke-authoritative-session'
         AND "sessionToken" = 'v1:' || repeat('a', 64)
         AND "authSessionRevision" = 0
         AND "authPolicyRevision" = 1
         AND "issuedAt" = TIMESTAMP '2026-08-30 12:00:00'
         AND "expires" = TIMESTAMP '2026-08-31 12:00:00'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM "Session"
       WHERE "id" = 'codex-smoke-authoritative-session-revision'
         AND "authSessionRevision" = 2
         AND "authPolicyRevision" = 2
     )
     OR (
       SELECT "authSessionRevision"
       FROM "User"
       WHERE "id" = 'codex-smoke-session-user'
     ) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: valid legacy or authoritative session was not preserved exactly';
  END IF;

  RAISE NOTICE 'PASS: valid legacy and authoritative sessions are stored exactly';
END;
$$;

UPDATE "User"
SET "authSessionRevision" = 0
WHERE "id" = 'codex-smoke-session-user';

DO $$
DECLARE
  rejected_negative_user_revision BOOLEAN := false;
  rejected_digest_without_metadata BOOLEAN := false;
  rejected_partial_metadata BOOLEAN := false;
  rejected_negative_session_revision BOOLEAN := false;
  rejected_zero_policy_revision BOOLEAN := false;
  rejected_nonpositive_lifetime BOOLEAN := false;
  rejected_oversized_lifetime BOOLEAN := false;
  rejected_plaintext_authoritative_token BOOLEAN := false;
  rejected_wrong_version_digest BOOLEAN := false;
  rejected_short_digest BOOLEAN := false;
  rejected_uppercase_digest BOOLEAN := false;
  rejected_infinite_issued_at BOOLEAN := false;
  rejected_infinite_expiry BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE "User"
    SET "authSessionRevision" = -1
    WHERE "id" = 'codex-smoke-session-user';
  EXCEPTION WHEN check_violation THEN
    rejected_negative_user_revision := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires"
    ) VALUES (
      'codex-smoke-session-digest-without-metadata',
      'v1:' || repeat('1', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_digest_without_metadata := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires", "authSessionRevision"
    ) VALUES (
      'codex-smoke-session-partial',
      'codex-smoke-session-partial-token',
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      0
    );
  EXCEPTION WHEN check_violation THEN
    rejected_partial_metadata := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-negative-revision',
      'v1:' || repeat('b', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      -1,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_negative_session_revision := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-zero-policy',
      'v1:' || repeat('c', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      0,
      0,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_zero_policy_revision := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-nonpositive-lifetime',
      'v1:' || repeat('d', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-30 12:00:00',
      0,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_nonpositive_lifetime := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-oversized-lifetime',
      'v1:' || repeat('e', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00.001',
      0,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_oversized_lifetime := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-plaintext-token',
      'codex-smoke-authoritative-plaintext-token',
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      0,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_plaintext_authoritative_token := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-wrong-digest-version',
      'v2:' || repeat('2', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      0,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_wrong_version_digest := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-short-digest',
      'v1:' || repeat('3', 63),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      0,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_short_digest := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-uppercase-digest',
      'v1:' || repeat('A', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      0,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_uppercase_digest := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-infinite-issued-at',
      'v1:' || repeat('4', 64),
      'codex-smoke-session-user',
      TIMESTAMP '2026-08-31 12:00:00',
      0,
      1,
      'infinity'::timestamp
    );
  EXCEPTION WHEN check_violation THEN
    rejected_infinite_issued_at := true;
  END;

  BEGIN
    INSERT INTO "Session" (
      "id", "sessionToken", "userId", "expires",
      "authSessionRevision", "authPolicyRevision", "issuedAt"
    ) VALUES (
      'codex-smoke-session-infinite-expiry',
      'v1:' || repeat('5', 64),
      'codex-smoke-session-user',
      'infinity'::timestamp,
      0,
      1,
      TIMESTAMP '2026-08-30 12:00:00'
    );
  EXCEPTION WHEN check_violation THEN
    rejected_infinite_expiry := true;
  END;

  IF NOT rejected_negative_user_revision
     OR NOT rejected_digest_without_metadata
     OR NOT rejected_partial_metadata
     OR NOT rejected_negative_session_revision
     OR NOT rejected_zero_policy_revision
     OR NOT rejected_nonpositive_lifetime
     OR NOT rejected_oversized_lifetime
     OR NOT rejected_plaintext_authoritative_token
     OR NOT rejected_wrong_version_digest
     OR NOT rejected_short_digest
     OR NOT rejected_uppercase_digest
     OR NOT rejected_infinite_issued_at
     OR NOT rejected_infinite_expiry THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: invalid authoritative session metadata was accepted';
  END IF;

  RAISE NOTICE 'PASS: invalid authoritative session metadata was rejected';
END;
$$;

DO $$
DECLARE
  rejected_second_singleton BOOLEAN := false;
  rejected_zero_revision BOOLEAN := false;
  rejected_unknown_policy BOOLEAN := false;
  rejected_staged_without_deadline BOOLEAN := false;
  rejected_audit_with_deadline BOOLEAN := false;
  rejected_strict_with_deadline BOOLEAN := false;
  rejected_infinite_deadline BOOLEAN := false;
  rejected_infinite_created_at BOOLEAN := false;
  rejected_infinite_updated_at BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "AuthPolicyState" (
      "id", "revision", "policy", "createdAt", "updatedAt"
    ) VALUES (
      2,
      1,
      'audit',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  EXCEPTION WHEN check_violation THEN
    rejected_second_singleton := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET "revision" = 0
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_zero_revision := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET "policy" = 'unknown'
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_unknown_policy := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET "policy" = 'staged', "stagedGraceDeadline" = NULL
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_staged_without_deadline := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET
      "policy" = 'audit',
      "stagedGraceDeadline" = TIMESTAMP '2026-09-01 00:00:00'
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_audit_with_deadline := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET
      "policy" = 'strict',
      "stagedGraceDeadline" = TIMESTAMP '2026-09-01 00:00:00'
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_strict_with_deadline := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET
      "policy" = 'staged',
      "stagedGraceDeadline" = 'infinity'::timestamp
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_infinite_deadline := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET "createdAt" = 'infinity'::timestamp
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_infinite_created_at := true;
  END;

  BEGIN
    UPDATE "AuthPolicyState"
    SET "updatedAt" = '-infinity'::timestamp
    WHERE "id" = 1;
  EXCEPTION WHEN check_violation THEN
    rejected_infinite_updated_at := true;
  END;

  IF NOT rejected_second_singleton
     OR NOT rejected_zero_revision
     OR NOT rejected_unknown_policy
     OR NOT rejected_staged_without_deadline
     OR NOT rejected_audit_with_deadline
     OR NOT rejected_strict_with_deadline
     OR NOT rejected_infinite_deadline
     OR NOT rejected_infinite_created_at
     OR NOT rejected_infinite_updated_at THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: invalid AuthPolicyState row was accepted';
  END IF;

  UPDATE "AuthPolicyState"
  SET
    "revision" = 2,
    "policy" = 'staged',
    "stagedGraceDeadline" = TIMESTAMP '2026-09-01 00:00:00',
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 1;

  IF NOT EXISTS (
    SELECT 1
    FROM "AuthPolicyState"
    WHERE "id" = 1
      AND "revision" = 2
      AND "policy" = 'staged'
      AND "stagedGraceDeadline" = TIMESTAMP '2026-09-01 00:00:00'
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: valid staged AuthPolicyState was rejected';
  END IF;

  UPDATE "AuthPolicyState"
  SET
    "revision" = 3,
    "policy" = 'strict',
    "stagedGraceDeadline" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 1;

  IF NOT EXISTS (
    SELECT 1
    FROM "AuthPolicyState"
    WHERE "id" = 1
      AND "revision" = 3
      AND "policy" = 'strict'
      AND "stagedGraceDeadline" IS NULL
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: valid strict AuthPolicyState was rejected';
  END IF;

  UPDATE "AuthPolicyState"
  SET
    "revision" = 1,
    "policy" = 'audit',
    "stagedGraceDeadline" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 1;

  RAISE NOTICE 'PASS: AuthPolicyState singleton and policy constraints are enforced';
END;
$$;

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

-- ============================================================
-- Sekcije stranica (20260902120000_expand_page_sections)
-- ============================================================
--
-- Baza ne zna oblik `config`-a; to proverava registar u aplikaciji. Ovde se
-- proverava samo ono što ne sme da zavisi od ispravnosti aplikacije: da tabele
-- i indeksi postoje u dogovorenom obliku i da devet CHECK ograničenja zaista
-- odbija loše redove. Svaki negativan scenario ide u sopstvenu subtransakciju,
-- pa neuspeh jednog ne obara ostale.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE "table_schema" = 'public'
      AND "table_name" IN ('PageSection', 'MediaAsset', 'MediaAssetUsage')
    GROUP BY "table_schema"
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: page section tables are missing';
  END IF;

  -- `config` je obavezan i mora biti jsonb; nacrt-kolone moraju biti nullable,
  -- jer NULL je jedini način da se kaže „nema nacrta”.
  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" = 'PageSection'
      AND (
        ("column_name" = 'config' AND "is_nullable" = 'NO' AND "data_type" = 'jsonb')
        OR ("column_name" = 'draftConfig' AND "is_nullable" = 'YES' AND "data_type" = 'jsonb')
        OR ("column_name" = 'draftOrder' AND "is_nullable" = 'YES')
        OR ("column_name" = 'draftIsActive' AND "is_nullable" = 'YES')
        OR ("column_name" = 'publishedAt' AND "is_nullable" = 'YES')
      )
  ) IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: PageSection draft/publish column contract is invalid';
  END IF;

  -- Čitanje javne početne ide po ova tri polja; bez indeksa upit radi, ali
  -- sekvencijalno.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE "schemaname" = 'public'
      AND "tablename" = 'PageSection'
      AND "indexname" = 'PageSection_pageKey_isActive_order_idx'
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: PageSection lookup index is missing';
  END IF;

  -- Bez ovog jedinstvenog indeksa isto polje može dvaput da zabeleži upotrebu
  -- medija, pa brojanje referenci prestaje da bude pouzdano.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE "schemaname" = 'public'
      AND "tablename" = 'MediaAssetUsage'
      AND "indexname" = 'MediaAssetUsage_sectionId_polje_key'
  ) THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: MediaAssetUsage uniqueness index is missing';
  END IF;

  RAISE NOTICE 'PASS: page section schema contract is present';
END;
$$;

-- Pozitivan fixture: ispravna sekcija, ispravan medij i veza između njih moraju
-- proći. Bez ovoga bi provera prolazila i da ograničenja odbijaju baš sve.
DO $$
BEGIN
  INSERT INTO "PageSection" (
    "id", "pageKey", "kind", "order", "isActive", "config",
    "draftConfig", "draftOrder", "draftIsActive",
    "schemaVersion", "version", "updatedAt"
  ) VALUES (
    'codex-smoke-sekcija', 'home', 'hero', 0, true, '{"naslov": {}}'::jsonb,
    '{"naslov": {}}'::jsonb, 1, false,
    1, 0, CURRENT_TIMESTAMP
  );

  INSERT INTO "MediaAsset" (
    "id", "path", "folder", "mimeType", "width", "height", "bytes", "createdAt"
  ) VALUES (
    'codex-smoke-medij', '/uploads/sekcije/1-a.webp', 'sekcije',
    'image/webp', 1600, 900, 42000, CURRENT_TIMESTAMP
  );

  INSERT INTO "MediaAssetUsage" ("id", "assetId", "sectionId", "polje")
  VALUES ('codex-smoke-upotreba', 'codex-smoke-medij', 'codex-smoke-sekcija', 'slika');

  RAISE NOTICE 'PASS: valid page section fixture was accepted';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PageSection" (
      "id", "pageKey", "kind", "order", "config", "schemaVersion", "version", "updatedAt"
    ) VALUES (
      'codex-smoke-negativan-redosled', 'home', 'hero', -1, '{}'::jsonb, 1, 0, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: negative PageSection order was accepted';
  END IF;

  RAISE NOTICE 'PASS: negative PageSection order was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PageSection" (
      "id", "pageKey", "kind", "order", "config", "schemaVersion", "version", "updatedAt"
    ) VALUES (
      'codex-smoke-negativna-verzija', 'home', 'hero', 0, '{}'::jsonb, 1, -1, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: negative PageSection version was accepted';
  END IF;

  RAISE NOTICE 'PASS: negative PageSection version was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PageSection" (
      "id", "pageKey", "kind", "order", "config", "draftOrder",
      "schemaVersion", "version", "updatedAt"
    ) VALUES (
      'codex-smoke-negativan-nacrt-redosled', 'home', 'hero', 0, '{}'::jsonb, -1,
      1, 0, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: negative PageSection draftOrder was accepted';
  END IF;

  RAISE NOTICE 'PASS: negative PageSection draftOrder was rejected';
END;
$$;

-- Dvotačka je namerno zabranjena dok odluka o dometu (`stranica:<slug>`) ne
-- bude doneta. Ovaj scenario je čuva od tihog uvođenja.
DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PageSection" (
      "id", "pageKey", "kind", "order", "config", "schemaVersion", "version", "updatedAt"
    ) VALUES (
      'codex-smoke-los-pagekey', 'stranica:o-nama', 'hero', 0, '{}'::jsonb, 1, 0, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: malformed PageSection pageKey was accepted';
  END IF;

  RAISE NOTICE 'PASS: malformed PageSection pageKey was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PageSection" (
      "id", "pageKey", "kind", "order", "config", "schemaVersion", "version", "updatedAt"
    ) VALUES (
      'codex-smoke-los-kind', 'home', 'Hero-Sekcija', 0, '{}'::jsonb, 1, 0, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: malformed PageSection kind was accepted';
  END IF;

  RAISE NOTICE 'PASS: malformed PageSection kind was rejected';
END;
$$;

-- Niz ili skalar u `config`-u znači da čitač dobija oblik koji ne ume da
-- pročita, a greška bi izbila tek pri renderu javne stranice.
DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PageSection" (
      "id", "pageKey", "kind", "order", "config", "schemaVersion", "version", "updatedAt"
    ) VALUES (
      'codex-smoke-config-niz', 'home', 'hero', 0, '[]'::jsonb, 1, 0, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: non-object PageSection config was accepted';
  END IF;

  RAISE NOTICE 'PASS: non-object PageSection config was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "PageSection" (
      "id", "pageKey", "kind", "order", "config", "draftConfig",
      "schemaVersion", "version", "updatedAt"
    ) VALUES (
      'codex-smoke-nacrt-skalar', 'home', 'hero', 0, '{}'::jsonb, '"tekst"'::jsonb,
      1, 0, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: non-object PageSection draftConfig was accepted';
  END IF;

  RAISE NOTICE 'PASS: non-object PageSection draftConfig was rejected';
END;
$$;

-- Putanja mora početi alfanumerikom, pa `..` ne može da izađe iz foldera.
DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "MediaAsset" (
      "id", "path", "folder", "mimeType", "width", "height", "bytes", "createdAt"
    ) VALUES (
      'codex-smoke-izlazak', '/uploads/sekcije/../../etc/passwd', 'sekcije',
      'image/webp', 10, 10, 10, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: traversing MediaAsset path was accepted';
  END IF;

  RAISE NOTICE 'PASS: traversing MediaAsset path was rejected';
END;
$$;

DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "MediaAsset" (
      "id", "path", "folder", "mimeType", "width", "height", "bytes", "createdAt"
    ) VALUES (
      'codex-smoke-nulta-visina', '/uploads/sekcije/2-b.webp', 'sekcije',
      'image/webp', 1600, 0, 42000, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN check_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: zero MediaAsset dimension was accepted';
  END IF;

  RAISE NOTICE 'PASS: zero MediaAsset dimension was rejected';
END;
$$;

-- Isto polje iste sekcije ne sme dvaput da zabeleži upotrebu medija: brojanje
-- referenci je jedina zaštita od brisanja slike sa žive stranice.
DO $$
DECLARE
  rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO "MediaAssetUsage" ("id", "assetId", "sectionId", "polje")
    VALUES ('codex-smoke-upotreba-duplikat', 'codex-smoke-medij', 'codex-smoke-sekcija', 'slika');
  EXCEPTION
    WHEN unique_violation THEN
      rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION
      'DB invariant smoke failed: duplicate MediaAssetUsage field was accepted';
  END IF;

  RAISE NOTICE 'PASS: duplicate MediaAssetUsage field was rejected';
END;
$$;

SET CONSTRAINTS ALL IMMEDIATE;

ROLLBACK;
