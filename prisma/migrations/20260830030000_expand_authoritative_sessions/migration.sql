-- Compatibility expand for database-authoritative sessions.
-- Existing JWT behavior and legacy Session rows remain valid until the
-- application cutover and the later contract migration.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
-- Metadata changes and the expiry index still take locks. Fail instead of
-- waiting indefinitely so the migration can be retried in a reviewed window.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

ALTER TABLE public."User"
  ADD COLUMN "authSessionRevision" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "User_authSessionRevision_nonnegative_check"
    CHECK ("authSessionRevision" >= 0);

ALTER TABLE public."Session"
  ADD COLUMN "authSessionRevision" INTEGER,
  ADD COLUMN "authPolicyRevision" INTEGER,
  ADD COLUMN "issuedAt" TIMESTAMP(3),
  ADD CONSTRAINT "Session_authoritative_metadata_check"
    CHECK (
      (
        "authSessionRevision" IS NULL
        AND "authPolicyRevision" IS NULL
        AND "issuedAt" IS NULL
        AND "sessionToken" !~ '^v1:[0-9a-f]{64}$'
      )
      OR
      (
        "authSessionRevision" IS NOT NULL
        AND "authSessionRevision" >= 0
        AND "authPolicyRevision" IS NOT NULL
        AND "authPolicyRevision" >= 1
        AND "issuedAt" IS NOT NULL
        AND pg_catalog.isfinite("issuedAt")
        AND pg_catalog.isfinite("expires")
        AND "expires" > "issuedAt"
        AND "expires" <= "issuedAt" + INTERVAL '24 hours'
        AND "sessionToken" ~ '^v1:[0-9a-f]{64}$'
      )
    );

CREATE INDEX "Session_expires_idx"
  ON public."Session" ("expires");

CREATE TABLE public."AuthPolicyState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "policy" TEXT NOT NULL DEFAULT 'audit',
  "stagedGraceDeadline" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthPolicyState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthPolicyState_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "AuthPolicyState_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "AuthPolicyState_policy_check"
    CHECK ("policy" IN ('audit', 'staged', 'strict')),
  CONSTRAINT "AuthPolicyState_deadline_check"
    CHECK (
      (
        "policy" = 'staged'
        AND "stagedGraceDeadline" IS NOT NULL
        AND pg_catalog.isfinite("stagedGraceDeadline")
      )
      OR
      (
        "policy" IN ('audit', 'strict')
        AND "stagedGraceDeadline" IS NULL
      )
    ),
  CONSTRAINT "AuthPolicyState_timestamps_check"
    CHECK (
      pg_catalog.isfinite("createdAt")
      AND pg_catalog.isfinite("updatedAt")
    )
);

INSERT INTO public."AuthPolicyState" (
  "id",
  "revision",
  "policy",
  "stagedGraceDeadline",
  "createdAt",
  "updatedAt"
) VALUES (
  1,
  1,
  'audit',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

COMMIT;
