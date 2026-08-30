-- Fail-closed aggregate preflight exclusively for STAGED verified-login rollout.
-- STRICT is intentionally rejected and requires a separate reviewed gate after
-- the grace window. Required psql variables use canonical UTC millisecond form:
--   target_policy=staged
--   legacy_cutoff=YYYY-MM-DDTHH:MM:SS.mmmZ
--   grace_deadline=YYYY-MM-DDTHH:MM:SS.mmmZ
-- public."Session" is telemetry-only because the application uses JWT
-- sessions. This revision intentionally remains blocked until a separately
-- reviewed JWT policy-revalidation design is implemented and this gate is
-- revised with it.
-- Output is strictly category|count. Missing required inputs and reported
-- blockers deliberately raise a sanitized SQL error so psql exits with its
-- documented ON_ERROR_STOP script-error status 3. `\quit N` must not be used:
-- PostgreSQL 16 treats N as an ignored argument and exits successfully.
\set ON_ERROR_STOP on
\set QUIET 1
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
\pset pager off

\if :{?legacy_cutoff}
\else
  DO $missing_legacy_cutoff$
  BEGIN
    RAISE EXCEPTION 'Verified-login preflight requires legacy_cutoff';
  END;
  $missing_legacy_cutoff$;
\endif
\if :{?grace_deadline}
\else
  DO $missing_grace_deadline$
  BEGIN
    RAISE EXCEPTION 'Verified-login preflight requires grace_deadline';
  END;
  $missing_grace_deadline$;
\endif
\if :{?target_policy}
\else
  DO $missing_target_policy$
  BEGIN
    RAISE EXCEPTION 'Verified-login preflight requires target_policy';
  END;
  $missing_target_policy$;
\endif

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
    RAISE EXCEPTION 'Verified-login preflight requires UTF8 server encoding';
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
    RAISE EXCEPTION 'Verified-login preflight schema contract is unavailable';
  END IF;
END;
$schema_check$;

-- The report remains a single read-only statement. Its one non-data side
-- effect is a transaction-local custom setting carrying only the final
-- boolean, so psql can fail closed after emitting category|count rows.
WITH
raw_parameters AS MATERIALIZED (
  SELECT
    -- Sample the PostgreSQL clock once, after locks and schema validation.
    (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) AS audit_at,
    :'target_policy'::text AS target_policy,
    :'legacy_cutoff'::text AS legacy_cutoff_text,
    :'grace_deadline'::text AS grace_deadline_text
),
parsed_parameters AS MATERIALIZED (
  SELECT
    raw_parameters.*,
    CASE
      WHEN legacy_cutoff_text COLLATE "C" ~
        '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9][.][0-9]{3}Z$'
      THEN legacy_cutoff_text::timestamptz
      ELSE NULL
    END AS legacy_cutoff_tz,
    CASE
      WHEN grace_deadline_text COLLATE "C" ~
        '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9][.][0-9]{3}Z$'
      THEN grace_deadline_text::timestamptz
      ELSE NULL
    END AS grace_deadline_tz
  FROM raw_parameters
),
parameters AS MATERIALIZED (
  SELECT
    audit_at,
    target_policy,
    (legacy_cutoff_tz AT TIME ZONE 'UTC')::timestamp(3) AS legacy_cutoff,
    (grace_deadline_tz AT TIME ZONE 'UTC')::timestamp(3) AS grace_deadline,
    coalesce(
      to_char(
        legacy_cutoff_tz AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) = legacy_cutoff_text,
      false
    ) AS cutoff_is_canonical,
    coalesce(
      to_char(
        grace_deadline_tz AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) = grace_deadline_text,
      false
    ) AS grace_deadline_is_canonical
  FROM parsed_parameters
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
    -- Never use this telemetry row as evidence that a JWT was revalidated.
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
    coalesce(
      account."emailVerificationLoginGraceUntil" IS NOT NULL
      AND isfinite(account."emailVerificationLoginGraceUntil")
      AND account."emailVerificationLoginGraceUntil" > parameters.audit_at
      AND account."emailVerificationLoginGraceUntil"
            = parameters.grace_deadline,
      false
    ) AS active_login_grace,
    account."passwordHash" COLLATE "C" ~
      $bcrypt_re$^\$2[ab]\$(0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$$bcrypt_re$
      AS bcrypt_format_valid,
    account."passwordHash" COLLATE "C" ~
      $bcrypt_cost_re$^\$2[ab]\$12\$[./A-Za-z0-9]{53}$$bcrypt_cost_re$
      AS bcrypt_cost_12
  FROM classified_users AS account
  CROSS JOIN parameters
),
base_findings AS (
  SELECT 1 AS ordinal, 'preflight.target_policy.not_staged' AS category,
    count(*)::bigint AS finding_count, true AS blocking
    FROM parameters
    WHERE target_policy <> 'staged'
  UNION ALL
  SELECT 10 AS ordinal, 'preflight.cutoff.invalid' AS category,
    count(*)::bigint AS finding_count, true AS blocking
    FROM parameters
    WHERE NOT cutoff_is_canonical
       OR legacy_cutoff IS NULL
       OR NOT isfinite(legacy_cutoff)
       OR legacy_cutoff > audit_at
  UNION ALL
  SELECT 11, 'preflight.grace_deadline.invalid', count(*)::bigint, true
    FROM parameters
    WHERE NOT grace_deadline_is_canonical
       OR grace_deadline IS NULL
       OR NOT isfinite(grace_deadline)
       OR grace_deadline < audit_at + INTERVAL '7 days'
       OR grace_deadline > audit_at + INTERVAL '30 days'
  UNION ALL
  SELECT 20, 'preflight.email.valid_after_trim_lower', count(*)::bigint, true
    FROM user_facts WHERE normalized_valid AND email <> normalized_email
  UNION ALL
  SELECT 30, 'preflight.email.irreparable_invalid', count(*)::bigint, true
    FROM user_facts WHERE NOT normalized_valid
  UNION ALL
  SELECT 40, 'preflight.email.normalized_duplicate_groups', count(*)::bigint, true
    FROM duplicate_email_groups
  UNION ALL
  SELECT 50, 'preflight.email.normalized_duplicate_rows',
    coalesce(sum(row_count), 0)::bigint, false FROM duplicate_email_groups
  UNION ALL
  SELECT 60, 'preflight.role.operator_unverified', count(*)::bigint, true
    FROM user_facts WHERE role::text = 'OPERATOR' AND "emailVerified" IS NULL
  UNION ALL
  SELECT 70, 'preflight.role.admin_unverified', count(*)::bigint, true
    FROM user_facts WHERE role::text = 'ADMIN' AND "emailVerified" IS NULL
  UNION ALL
  SELECT 75, 'preflight.jwt_session_revalidation.unavailable', 1::bigint, true
  UNION ALL
  SELECT 80, 'preflight.role.unexpected', count(*)::bigint, true
    FROM user_facts WHERE role::text NOT IN ('CUSTOMER', 'OPERATOR', 'ADMIN')
  UNION ALL
  SELECT 85, 'preflight.created_at.nonfinite', count(*)::bigint, true
    FROM user_facts WHERE NOT isfinite("createdAt")
  UNION ALL
  SELECT 86, 'preflight.created_at.in_future', count(*)::bigint, true
    FROM user_facts CROSS JOIN parameters
    WHERE isfinite("createdAt") AND "createdAt" > parameters.audit_at
  UNION ALL
  SELECT 90, 'preflight.verified.before_created_at', count(*)::bigint, true
    FROM user_facts WHERE "emailVerified" < "createdAt"
  UNION ALL
  SELECT 100, 'preflight.verified.in_future', count(*)::bigint, true
    FROM user_facts CROSS JOIN parameters
    WHERE "emailVerified" > parameters.audit_at
  UNION ALL
  SELECT 110, 'preflight.tokens.malformed', count(*)::bigint, true
    FROM public."EmailVerification"
    WHERE NOT coalesce("tokenHash" COLLATE "C" ~ '^v1:[0-9a-f]{64}$', false)
      AND NOT (
        "tokenHash" IS NULL
        AND coalesce(token COLLATE "C" ~ '^[0-9a-f]{64}$', false)
      )
  UNION ALL
  SELECT 111, 'preflight.tokens.created_at.nonfinite', count(*)::bigint, true
    FROM public."EmailVerification"
    WHERE NOT isfinite("createdAt")
  UNION ALL
  SELECT 112, 'preflight.tokens.created_at.in_future', count(*)::bigint, true
    FROM public."EmailVerification" CROSS JOIN parameters
    WHERE isfinite("createdAt") AND "createdAt" > parameters.audit_at
  UNION ALL
  SELECT 113, 'preflight.tokens.expires.nonfinite', count(*)::bigint, true
    FROM public."EmailVerification"
    WHERE NOT isfinite(expires)
  UNION ALL
  SELECT 114, 'preflight.tokens.lifetime.invalid', count(*)::bigint, true
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
  SELECT 120, 'preflight.verified.with_leftover_tokens', count(*)::bigint, true
    FROM user_facts WHERE "emailVerified" IS NOT NULL AND has_token
  UNION ALL
  SELECT 130, 'preflight.throttle.partial_or_invalid', count(*)::bigint, true
    FROM user_facts WHERE NOT throttle_all_null AND NOT throttle_all_valid
  UNION ALL
  SELECT 135, 'preflight.throttle.future_or_clock_skew', count(*)::bigint, false
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
  SELECT 140, 'preflight.verified.with_nonnull_throttle', count(*)::bigint, true
    FROM user_facts
    WHERE "emailVerified" IS NOT NULL AND NOT throttle_all_null
  UNION ALL
  SELECT 150, 'preflight.login_grace.nonfinite', count(*)::bigint, true
    FROM user_facts
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND NOT isfinite("emailVerificationLoginGraceUntil")
  UNION ALL
  SELECT 155, 'preflight.login_grace.unapproved_deadline', count(*)::bigint, true
    FROM user_facts CROSS JOIN parameters
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND isfinite("emailVerificationLoginGraceUntil")
      AND "emailVerificationLoginGraceUntil"
            IS DISTINCT FROM parameters.grace_deadline
  UNION ALL
  SELECT 160, 'preflight.login_grace.before_created_at', count(*)::bigint, true
    FROM user_facts
    WHERE "emailVerificationLoginGraceUntil" IS NOT NULL
      AND isfinite("emailVerificationLoginGraceUntil")
      AND "emailVerificationLoginGraceUntil" < "createdAt"
  UNION ALL
  SELECT 170, 'preflight.login_grace.verified_nonnull', count(*)::bigint, true
    FROM user_facts
    WHERE "emailVerified" IS NOT NULL
      AND "emailVerificationLoginGraceUntil" IS NOT NULL
  UNION ALL
  SELECT 180, 'preflight.login_grace.post_cutoff_nonnull', count(*)::bigint, true
    FROM user_facts CROSS JOIN parameters
    WHERE "createdAt" >= parameters.legacy_cutoff
      AND "emailVerificationLoginGraceUntil" IS NOT NULL
  UNION ALL
  SELECT 190, 'preflight.legacy_unverified_without_active_grace',
    count(*)::bigint, true
    FROM user_facts CROSS JOIN parameters
    WHERE "emailVerified" IS NULL
      AND "createdAt" < parameters.legacy_cutoff
      AND NOT active_login_grace
  UNION ALL
  SELECT 200, 'preflight.unverified_activity_without_active_grace',
    count(*)::bigint, true
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
      AND NOT active_login_grace
  UNION ALL
  SELECT 201, 'preflight.unverified.with_active_db_session_telemetry_only',
    count(*)::bigint, false
    FROM user_facts
    WHERE "emailVerified" IS NULL AND has_active_db_session_telemetry
  UNION ALL
  SELECT 210, 'preflight.password.invalid_or_unsupported_bcrypt_format', count(*)::bigint, true
    FROM user_facts WHERE NOT bcrypt_format_valid
  UNION ALL
  SELECT 220, 'preflight.password.valid_format_but_non_cost_12', count(*)::bigint, true
    FROM user_facts WHERE bcrypt_format_valid AND NOT bcrypt_cost_12
),
summary AS MATERIALIZED (
  SELECT
    count(*) FILTER (
      WHERE blocking AND finding_count <> 0
    )::bigint AS blocking_categories,
    NOT coalesce(
      bool_or(blocking AND finding_count <> 0),
      false
    ) AS preflight_ok
  FROM base_findings
),
record_preflight_state AS MATERIALIZED (
  SELECT pg_catalog.set_config(
    'narodnanosnja.auth_preflight_ok',
    preflight_ok::text,
    true
  ) AS recorded
  FROM summary
),
report AS (
  SELECT ordinal, category, finding_count
  FROM base_findings
  UNION ALL
  SELECT
    1000,
    'preflight.blocking_categories',
    blocking_categories
  FROM summary
  UNION ALL
  SELECT
    1010,
    'preflight.ready',
    CASE WHEN preflight_ok THEN 1::bigint ELSE 0::bigint END
  FROM summary
)
SELECT report.category, report.finding_count
FROM report
CROSS JOIN record_preflight_state
ORDER BY report.ordinal;

SELECT pg_catalog.current_setting(
  'narodnanosnja.auth_preflight_ok'
)::boolean AS preflight_ok
\gset auth_

\if :auth_preflight_ok
  ROLLBACK;
\else
  ROLLBACK;
  DO $blocked_preflight$
  BEGIN
    RAISE EXCEPTION 'Verified-login preflight reported blocking categories';
  END;
  $blocked_preflight$;
\endif
