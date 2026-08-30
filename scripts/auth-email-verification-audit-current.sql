-- Aggregate-only audit for the fully expanded auth schema. It never emits an
-- account row, email address, credential or timestamp; output is category|count.
\set ON_ERROR_STOP on
\set QUIET 1
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\pset pager off

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '90s';
SET LOCAL TIME ZONE 'UTC';

LOCK TABLE
  public."User",
  public."EmailVerification",
  public."Session",
  public."PasswordReset",
  public."Order",
  public."Address",
  public."Wishlist",
  public."ProductReview",
  public."CouponUsage"
IN ACCESS SHARE MODE;

DO $schema_check$
DECLARE
  invalid_contracts BIGINT;
BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'Current auth audit requires UTF8 server encoding';
  END IF;

  SELECT count(*)
  INTO invalid_contracts
  FROM (
    VALUES
      ('User', 'id', 'text', 'pg_catalog', 'text', 'NO', NULL::integer),
      ('User', 'email', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('User', 'passwordHash', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('User', 'role', 'USER-DEFINED', 'public', 'Role', 'NO', NULL),
      ('User', 'emailVerified', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'YES', 3),
      ('User', 'emailVerificationLoginGraceUntil', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'YES', 3),
      ('User', 'verificationEmailNextAllowedAt', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'YES', 3),
      ('User', 'verificationEmailResendWindowStartedAt', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'YES', 3),
      ('User', 'verificationEmailResendCount', 'integer', 'pg_catalog', 'int4', 'YES', NULL),
      ('User', 'createdAt', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'NO', 3),
      ('EmailVerification', 'userId', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('EmailVerification', 'token', 'text', 'pg_catalog', 'text', 'YES', NULL),
      ('EmailVerification', 'tokenHash', 'text', 'pg_catalog', 'text', 'YES', NULL),
      ('EmailVerification', 'expires', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'NO', 3),
      ('EmailVerification', 'createdAt', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'NO', 3),
      ('Session', 'userId', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('Session', 'expires', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'NO', 3),
      ('PasswordReset', 'userId', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('PasswordReset', 'token', 'text', 'pg_catalog', 'text', 'YES', NULL),
      ('PasswordReset', 'tokenHash', 'text', 'pg_catalog', 'text', 'YES', NULL),
      ('PasswordReset', 'expires', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'NO', 3),
      ('PasswordReset', 'createdAt', 'timestamp without time zone', 'pg_catalog', 'timestamp', 'NO', 3),
      ('Order', 'userId', 'text', 'pg_catalog', 'text', 'YES', NULL),
      ('Address', 'userId', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('Wishlist', 'userId', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('ProductReview', 'userId', 'text', 'pg_catalog', 'text', 'NO', NULL),
      ('CouponUsage', 'userId', 'text', 'pg_catalog', 'text', 'YES', NULL)
  ) AS required(
    table_name,
    column_name,
    data_type,
    udt_schema,
    udt_name,
    is_nullable,
    datetime_precision
  )
  LEFT JOIN information_schema.columns AS actual
    ON actual.table_schema = 'public'
   AND actual.table_name = required.table_name
   AND actual.column_name = required.column_name
  WHERE actual.column_name IS NULL
     OR actual.data_type IS DISTINCT FROM required.data_type
     OR actual.udt_schema IS DISTINCT FROM required.udt_schema
     OR actual.udt_name IS DISTINCT FROM required.udt_name
     OR actual.is_nullable IS DISTINCT FROM required.is_nullable
     OR actual.datetime_precision IS DISTINCT FROM required.datetime_precision;

  IF invalid_contracts <> 0 THEN
    RAISE EXCEPTION 'Current auth audit schema contract is unavailable';
  END IF;
END;
$schema_check$;

WITH
parameters AS MATERIALIZED (
  -- Sample the PostgreSQL clock once, after all table locks and schema checks.
  SELECT (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS audit_at
),
trimmed_users AS MATERIALIZED (
  SELECT
    account.*,
    btrim(
      account.email,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    ) AS trimmed_email
  FROM public."User" AS account
),
normalized_users AS MATERIALIZED (
  SELECT
    trimmed_users.*,
    translate(
      trimmed_email,
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz'
    ) AS normalized_email
  FROM trimmed_users
),
classified_users AS MATERIALIZED (
  SELECT
    normalized_users.*,
    (
      char_length(normalized_email) BETWEEN 3 AND 254
      AND position('@' IN normalized_email) BETWEEN 2 AND 65
      AND normalized_email COLLATE "C" ~
        $email_re$^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$$email_re$
    ) AS normalized_valid
  FROM normalized_users
),
duplicate_email_groups AS MATERIALIZED (
  SELECT normalized_email, count(*)::bigint AS row_count
  FROM classified_users
  WHERE normalized_valid
  GROUP BY normalized_email
  HAVING count(*) > 1
),
user_facts AS MATERIALIZED (
  SELECT
    account.*,
    EXISTS (
      SELECT 1
      FROM public."EmailVerification" AS verification
      WHERE verification."userId" = account.id
    ) AS has_token,
    EXISTS (
      SELECT 1
      FROM public."EmailVerification" AS verification
      CROSS JOIN parameters
      WHERE verification."userId" = account.id
        AND isfinite(verification."createdAt")
        AND isfinite(verification.expires)
        AND verification."createdAt" <= parameters.audit_at
        AND verification.expires > parameters.audit_at
        AND verification.expires > verification."createdAt"
        AND verification.expires
              <= verification."createdAt" + INTERVAL '65 minutes'
    ) AS has_active_token,
    EXISTS (
      SELECT 1
      FROM public."EmailVerification" AS verification
      CROSS JOIN parameters
      WHERE verification."userId" = account.id
        AND (
          NOT isfinite(verification."createdAt")
          OR NOT isfinite(verification.expires)
          OR verification."createdAt" > parameters.audit_at
          OR verification.expires <= verification."createdAt"
          -- Runtime issues a 60-minute token. Five minutes is the explicit
          -- maximum tolerated historical application/DB clock skew.
          OR verification.expires
               > verification."createdAt" + INTERVAL '65 minutes'
        )
    ) AS has_invalid_token_time,
    -- This application uses JWT sessions. A row in public."Session" is only
    -- aggregate telemetry and is never proof that a JWT was revalidated.
    EXISTS (
      SELECT 1 FROM public."Session" AS stored_session
      CROSS JOIN parameters
      WHERE stored_session."userId" = account.id
        AND isfinite(stored_session.expires)
        AND stored_session.expires > parameters.audit_at
    ) AS has_active_db_session_telemetry,
    EXISTS (
      SELECT 1 FROM public."PasswordReset" AS password_reset
      CROSS JOIN parameters
      WHERE password_reset."userId" = account.id
        AND isfinite(password_reset."createdAt")
        AND isfinite(password_reset.expires)
        AND password_reset."createdAt" <= parameters.audit_at
        AND password_reset.expires > parameters.audit_at
        AND password_reset.expires > password_reset."createdAt"
        AND password_reset.expires
              <= password_reset."createdAt" + INTERVAL '65 minutes'
    ) AS has_active_password_reset,
    EXISTS (
      SELECT 1 FROM public."Order" AS customer_order
      WHERE customer_order."userId" = account.id
    ) AS has_order,
    EXISTS (
      SELECT 1 FROM public."Address" AS address
      WHERE address."userId" = account.id
    ) AS has_address,
    EXISTS (
      SELECT 1 FROM public."Wishlist" AS wishlist
      WHERE wishlist."userId" = account.id
    ) AS has_wishlist,
    EXISTS (
      SELECT 1 FROM public."ProductReview" AS review
      WHERE review."userId" = account.id
    ) AS has_review,
    EXISTS (
      SELECT 1 FROM public."CouponUsage" AS coupon_usage
      WHERE coupon_usage."userId" = account.id
    ) AS has_coupon_usage,
    (
      account."verificationEmailNextAllowedAt" IS NULL
      AND account."verificationEmailResendWindowStartedAt" IS NULL
      AND account."verificationEmailResendCount" IS NULL
    ) AS throttle_all_null,
    coalesce(
      account."verificationEmailNextAllowedAt" IS NOT NULL
      AND account."verificationEmailResendWindowStartedAt" IS NOT NULL
      AND account."verificationEmailResendCount" IS NOT NULL
      AND isfinite(account."verificationEmailNextAllowedAt")
      AND isfinite(account."verificationEmailResendWindowStartedAt")
      AND account."verificationEmailResendCount" BETWEEN 1 AND 5
      AND account."verificationEmailResendWindowStartedAt"
            <= parameters.audit_at
      AND account."verificationEmailNextAllowedAt"
            <= parameters.audit_at + INTERVAL '1 minute'
      AND account."verificationEmailNextAllowedAt"
            >= account."verificationEmailResendWindowStartedAt"
      AND account."verificationEmailNextAllowedAt"
            <= account."verificationEmailResendWindowStartedAt"
               + INTERVAL '24 hours 1 minute',
      false
    ) AS throttle_all_valid,
    account."passwordHash" COLLATE "C" ~
      $bcrypt_re$^\$2[ab]\$(0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$$bcrypt_re$
      AS bcrypt_format_valid,
    account."passwordHash" COLLATE "C" ~
      $bcrypt_cost_re$^\$2[ab]\$12\$[./A-Za-z0-9]{53}$$bcrypt_cost_re$
      AS bcrypt_cost_12
  FROM classified_users AS account
  CROSS JOIN parameters
),
findings AS (
  SELECT 10 AS ordinal, 'users.total' AS category,
    count(*)::bigint AS finding_count FROM user_facts
  UNION ALL
  SELECT 20, 'users.email.canonical_valid', count(*)::bigint
    FROM user_facts WHERE normalized_valid AND email = normalized_email
  UNION ALL
  SELECT 30, 'users.email.valid_after_trim_lower', count(*)::bigint
    FROM user_facts WHERE normalized_valid AND email <> normalized_email
  UNION ALL
  SELECT 40, 'users.email.irreparable_invalid', count(*)::bigint
    FROM user_facts WHERE NOT normalized_valid
  UNION ALL
  SELECT 50, 'users.email.normalized_duplicate_groups', count(*)::bigint
    FROM duplicate_email_groups
  UNION ALL
  SELECT 60, 'users.email.normalized_duplicate_rows',
    coalesce(sum(row_count), 0)::bigint FROM duplicate_email_groups
  UNION ALL
  SELECT 70, 'users.role.customer.verified', count(*)::bigint
    FROM user_facts WHERE role::text = 'CUSTOMER' AND "emailVerified" IS NOT NULL
  UNION ALL
  SELECT 80, 'users.role.customer.unverified', count(*)::bigint
    FROM user_facts WHERE role::text = 'CUSTOMER' AND "emailVerified" IS NULL
  UNION ALL
  SELECT 90, 'users.role.operator.verified', count(*)::bigint
    FROM user_facts WHERE role::text = 'OPERATOR' AND "emailVerified" IS NOT NULL
  UNION ALL
  SELECT 100, 'users.role.operator.unverified', count(*)::bigint
    FROM user_facts WHERE role::text = 'OPERATOR' AND "emailVerified" IS NULL
  UNION ALL
  SELECT 110, 'users.role.admin.verified', count(*)::bigint
    FROM user_facts WHERE role::text = 'ADMIN' AND "emailVerified" IS NOT NULL
  UNION ALL
  SELECT 120, 'users.role.admin.unverified', count(*)::bigint
    FROM user_facts WHERE role::text = 'ADMIN' AND "emailVerified" IS NULL
  UNION ALL
  SELECT 130, 'users.role.unexpected', count(*)::bigint
    FROM user_facts WHERE role::text NOT IN ('CUSTOMER', 'OPERATOR', 'ADMIN')
  UNION ALL
  SELECT 135, 'users.created_at.nonfinite', count(*)::bigint
    FROM user_facts WHERE NOT isfinite("createdAt")
  UNION ALL
  SELECT 136, 'users.created_at.in_future', count(*)::bigint
    FROM user_facts CROSS JOIN parameters
    WHERE isfinite("createdAt") AND "createdAt" > parameters.audit_at
  UNION ALL
  SELECT 140, 'users.verified.before_created_at', count(*)::bigint
    FROM user_facts WHERE "emailVerified" < "createdAt"
  UNION ALL
  SELECT 150, 'users.verified.in_future', count(*)::bigint
    FROM user_facts CROSS JOIN parameters
    WHERE "emailVerified" > parameters.audit_at
  UNION ALL
  SELECT 160, 'users.unverified.without_token', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NULL AND NOT has_token
  UNION ALL
  SELECT 170, 'users.unverified.with_active_token', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NULL AND has_active_token
  UNION ALL
  SELECT 180, 'users.unverified.with_only_expired_tokens', count(*)::bigint
    FROM user_facts
    WHERE "emailVerified" IS NULL
      AND has_token
      AND NOT has_active_token
      AND NOT has_invalid_token_time
  UNION ALL
  SELECT 190, 'tokens.credential.current_hash', count(*)::bigint
    FROM public."EmailVerification"
    WHERE "tokenHash" COLLATE "C" ~ '^v1:[0-9a-f]{64}$'
  UNION ALL
  SELECT 200, 'tokens.credential.legacy', count(*)::bigint
    FROM public."EmailVerification"
    WHERE "tokenHash" IS NULL
      AND token COLLATE "C" ~ '^[0-9a-f]{64}$'
  UNION ALL
  SELECT 210, 'tokens.credential.malformed', count(*)::bigint
    FROM public."EmailVerification"
    WHERE NOT coalesce("tokenHash" COLLATE "C" ~ '^v1:[0-9a-f]{64}$', false)
      AND NOT (
        "tokenHash" IS NULL
        AND coalesce(token COLLATE "C" ~ '^[0-9a-f]{64}$', false)
      )
  UNION ALL
  SELECT 211, 'tokens.created_at.nonfinite', count(*)::bigint
    FROM public."EmailVerification"
    WHERE NOT isfinite("createdAt")
  UNION ALL
  SELECT 212, 'tokens.created_at.in_future', count(*)::bigint
    FROM public."EmailVerification" CROSS JOIN parameters
    WHERE isfinite("createdAt") AND "createdAt" > parameters.audit_at
  UNION ALL
  SELECT 213, 'tokens.expires.nonfinite', count(*)::bigint
    FROM public."EmailVerification"
    WHERE NOT isfinite(expires)
  UNION ALL
  SELECT 214, 'tokens.lifetime.invalid', count(*)::bigint
    FROM public."EmailVerification"
    WHERE isfinite("createdAt")
      AND isfinite(expires)
      AND (
        expires <= "createdAt"
        -- Runtime issues a 60-minute token; retain only the explicit
        -- five-minute historical application/DB clock-skew allowance.
        OR expires > "createdAt" + INTERVAL '65 minutes'
      )
  UNION ALL
  SELECT 220, 'users.verified.with_leftover_tokens', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NOT NULL AND has_token
  UNION ALL
  SELECT 230, 'users.throttle.all_null', count(*)::bigint
    FROM user_facts WHERE throttle_all_null
  UNION ALL
  SELECT 240, 'users.throttle.all_valid', count(*)::bigint
    FROM user_facts WHERE throttle_all_valid
  UNION ALL
  SELECT 250, 'users.throttle.partial_or_invalid', count(*)::bigint
    FROM user_facts WHERE NOT throttle_all_null AND NOT throttle_all_valid
  UNION ALL
  SELECT 255, 'users.throttle.future_or_clock_skew', count(*)::bigint
    FROM user_facts CROSS JOIN parameters
    WHERE (
      "verificationEmailResendWindowStartedAt" IS NOT NULL
      AND isfinite("verificationEmailResendWindowStartedAt")
      AND "verificationEmailResendWindowStartedAt" > parameters.audit_at
    ) OR (
      "verificationEmailNextAllowedAt" IS NOT NULL
      AND isfinite("verificationEmailNextAllowedAt")
      AND "verificationEmailNextAllowedAt"
            > parameters.audit_at + INTERVAL '1 minute'
    )
  UNION ALL
  SELECT 260, 'users.verified.with_nonnull_throttle', count(*)::bigint
    FROM user_facts
    WHERE "emailVerified" IS NOT NULL AND NOT throttle_all_null
  UNION ALL
  SELECT 270, 'users.login_grace.null', count(*)::bigint
    FROM user_facts WHERE "emailVerificationLoginGraceUntil" IS NULL
  UNION ALL
  SELECT 280, 'users.login_grace.active', count(*)::bigint
    FROM user_facts CROSS JOIN parameters
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND isfinite("emailVerificationLoginGraceUntil")
      AND "emailVerificationLoginGraceUntil" > parameters.audit_at
  UNION ALL
  SELECT 290, 'users.login_grace.expired', count(*)::bigint
    FROM user_facts CROSS JOIN parameters
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND isfinite("emailVerificationLoginGraceUntil")
      AND "emailVerificationLoginGraceUntil" <= parameters.audit_at
  UNION ALL
  SELECT 300, 'users.login_grace.nonfinite', count(*)::bigint
    FROM user_facts
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND NOT isfinite("emailVerificationLoginGraceUntil")
  UNION ALL
  SELECT 305, 'users.login_grace.excessive_future', count(*)::bigint
    FROM user_facts CROSS JOIN parameters
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND isfinite("emailVerificationLoginGraceUntil")
      AND "emailVerificationLoginGraceUntil"
            > parameters.audit_at + INTERVAL '30 days'
  UNION ALL
  SELECT 310, 'users.login_grace.verified_nonnull', count(*)::bigint
    FROM user_facts
    WHERE "emailVerified" IS NOT NULL
      AND "emailVerificationLoginGraceUntil" IS NOT NULL
  UNION ALL
  SELECT 320, 'users.login_grace.before_created_at', count(*)::bigint
    FROM user_facts
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND isfinite("emailVerificationLoginGraceUntil")
      AND "emailVerificationLoginGraceUntil" < "createdAt"
  UNION ALL
  SELECT 330, 'users.unverified.with_order', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NULL AND has_order
  UNION ALL
  SELECT 340, 'users.unverified.with_address', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NULL AND has_address
  UNION ALL
  SELECT 350, 'users.unverified.with_wishlist', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NULL AND has_wishlist
  UNION ALL
  SELECT 360, 'users.unverified.with_review', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NULL AND has_review
  UNION ALL
  SELECT 361, 'users.unverified.with_active_db_session_telemetry_only', count(*)::bigint
    FROM user_facts
    WHERE "emailVerified" IS NULL AND has_active_db_session_telemetry
  UNION ALL
  SELECT 362, 'users.unverified.with_active_password_reset', count(*)::bigint
    FROM user_facts
    WHERE "emailVerified" IS NULL AND has_active_password_reset
  UNION ALL
  SELECT 363, 'users.unverified.with_coupon_usage', count(*)::bigint
    FROM user_facts WHERE "emailVerified" IS NULL AND has_coupon_usage
  UNION ALL
  SELECT 370, 'users.unverified.with_any_activity', count(*)::bigint
    FROM user_facts
    WHERE "emailVerified" IS NULL
      AND (
        has_order
        OR has_address
        OR has_wishlist
        OR has_review
        OR has_active_password_reset
        OR has_coupon_usage
      )
  UNION ALL
  SELECT 380, 'users.password.invalid_or_unsupported_bcrypt_format', count(*)::bigint
    FROM user_facts WHERE NOT bcrypt_format_valid
  UNION ALL
  SELECT 390, 'users.password.valid_format_but_non_cost_12', count(*)::bigint
    FROM user_facts WHERE bcrypt_format_valid AND NOT bcrypt_cost_12
)
SELECT category, finding_count
FROM findings
ORDER BY ordinal;

ROLLBACK;
