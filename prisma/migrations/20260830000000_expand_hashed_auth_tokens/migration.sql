-- Compatibility expand for hashed password-reset and email-verification tokens.
-- Plaintext columns and their existing indexes intentionally remain available
-- while old and new application versions overlap.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
-- Auth writes must never wait indefinitely behind this rollout. A timeout
-- aborts and rolls back the whole expand migration so it can be retried in a
-- reviewed maintenance window instead of partially changing the contract.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

-- Keep the preflight stable until the unique userId index is installed. This
-- initial lock blocks PasswordReset writes while allowing reads; the following
-- ALTER TABLE statements take stronger locks, so rollout must budget lock time.
LOCK TABLE "PasswordReset" IN SHARE ROW EXCLUSIVE MODE;

-- Fail closed instead of choosing or deleting a legacy duplicate. Production
-- rollout must audit and explicitly resolve duplicates before this migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PasswordReset"
    GROUP BY "userId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add PasswordReset_userId_key: duplicate PasswordReset.userId rows exist';
  END IF;
END;
$$;

-- AlterTable
ALTER TABLE "PasswordReset"
  ADD COLUMN "tokenHash" TEXT,
  ALTER COLUMN "token" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EmailVerification"
  ADD COLUMN "tokenHash" TEXT,
  ALTER COLUMN "token" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key"
  ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key"
  ON "EmailVerification"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_userId_key"
  ON "PasswordReset"("userId");

-- The unique userId index covers equality lookups, so the former non-unique
-- index would be redundant. Plaintext token indexes are intentionally retained.
DROP INDEX "PasswordReset_userId_idx";

COMMIT;
