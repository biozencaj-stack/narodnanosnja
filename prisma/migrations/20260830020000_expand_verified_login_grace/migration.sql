-- Compatibility expand for staged verified-login enforcement.
-- The nullable, no-default grace deadline lets the next application version
-- distinguish reviewed legacy accounts without changing login behaviour yet.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
-- Adding a nullable column without a default is metadata-only on PostgreSQL,
-- but ALTER TABLE still needs a brief ACCESS EXCLUSIVE lock. Fail instead of
-- waiting indefinitely so rollout can be retried in a reviewed window.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

ALTER TABLE "User"
  ADD COLUMN "emailVerificationLoginGraceUntil" TIMESTAMP(3);

COMMIT;
