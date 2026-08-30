\set ON_ERROR_STOP on

\if :{?fixture_grace_deadline}
\else
  \quit 2
\endif

BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'auth_audit_current_clean_provera' THEN
    RAISE EXCEPTION 'Refusing auth audit fixture outside its isolated test database';
  END IF;
END;
$guard$;

INSERT INTO public."User" (
  id, email, "passwordHash", "firstName", "lastName", role,
  "emailVerified", "emailVerificationLoginGraceUntil",
  "verificationEmailNextAllowedAt",
  "verificationEmailResendWindowStartedAt",
  "verificationEmailResendCount", "createdAt", "updatedAt"
)
VALUES
  (
    'audit-clean-user-1', 'customer@example.invalid',
    '$2a$12$' || repeat('a', 53), 'Clean', 'One', 'CUSTOMER',
    TIMESTAMP '2025-01-02 00:00:00', NULL, NULL, NULL, NULL,
    TIMESTAMP '2025-01-01 00:00:00', TIMESTAMP '2025-01-02 00:00:00'
  ),
  (
    'audit-clean-user-2', 'admin@example.invalid',
    '$2a$12$' || repeat('b', 53), 'Clean', 'Two', 'ADMIN',
    TIMESTAMP '2025-02-02 00:00:00', NULL, NULL, NULL, NULL,
    TIMESTAMP '2025-02-01 00:00:00', TIMESTAMP '2025-02-02 00:00:00'
  ),
  (
    'audit-clean-user-3', 'operator@example.invalid',
    '$2b$12$' || repeat('c', 53), 'Clean', 'Three', 'OPERATOR',
    TIMESTAMP '2025-03-02 00:00:00', NULL, NULL, NULL, NULL,
    TIMESTAMP '2025-03-01 00:00:00', TIMESTAMP '2025-03-02 00:00:00'
  ),
  (
    'audit-clean-user-4', 'legacy@example.invalid',
    '$2b$12$' || repeat('d', 53), 'Clean', 'Four', 'CUSTOMER', NULL,
    (:'fixture_grace_deadline'::timestamptz AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 minute',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 1,
    TIMESTAMP '2025-04-01 00:00:00', TIMESTAMP '2025-04-01 00:00:00'
  ),
  (
    'audit-clean-user-5', 'new@example.invalid',
    '$2a$12$' || repeat('e', 53), 'Clean', 'Five', 'CUSTOMER', NULL,
    NULL, NULL, NULL, NULL,
    TIMESTAMP '2026-02-01 00:00:00', TIMESTAMP '2026-02-01 00:00:00'
  );

INSERT INTO public."EmailVerification" (
  id, "userId", token, "tokenHash", expires, "createdAt"
)
VALUES
  (
    'audit-clean-token-1', 'audit-clean-user-4', repeat('a', 64),
    'v1:' || repeat('1', 64),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  ),
  (
    'audit-clean-token-2', 'audit-clean-user-5', repeat('b', 64), NULL,
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  );

COMMIT;
