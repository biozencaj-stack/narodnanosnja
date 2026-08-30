-- Compatibility expand for database-backed verification-email throttling.
-- Nullable, no-default columns keep old application versions compatible;
-- legacy users become immediately eligible on their first resend attempt.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
-- Adding a nullable column without a default is metadata-only on PostgreSQL,
-- but ALTER TABLE still needs a brief ACCESS EXCLUSIVE lock. Fail instead of
-- waiting indefinitely so rollout can be retried in a reviewed window.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

ALTER TABLE "User"
  ADD COLUMN "verificationEmailNextAllowedAt" TIMESTAMP(3),
  ADD COLUMN "verificationEmailResendWindowStartedAt" TIMESTAMP(3),
  ADD COLUMN "verificationEmailResendCount" INTEGER;

COMMIT;
