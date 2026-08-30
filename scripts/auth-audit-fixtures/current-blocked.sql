\set ON_ERROR_STOP on

\if :{?fixture_legacy_cutoff}
\else
  DO $missing_fixture_legacy_cutoff$
  BEGIN
    RAISE EXCEPTION 'Current blocked auth audit fixture requires fixture_legacy_cutoff';
  END;
  $missing_fixture_legacy_cutoff$;
\endif
\if :{?fixture_grace_deadline}
\else
  DO $missing_fixture_grace_deadline$
  BEGIN
    RAISE EXCEPTION 'Current blocked auth audit fixture requires fixture_grace_deadline';
  END;
  $missing_fixture_grace_deadline$;
\endif

BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'auth_audit_current_blocked_provera' THEN
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
    'audit-current-user-1', 'verified@example.invalid',
    '$2a$12$' || repeat('a', 53), 'Audit', 'One', 'CUSTOMER',
    TIMESTAMP '2025-01-02 00:00:00', NULL, NULL, NULL, NULL,
    TIMESTAMP '2025-01-01 00:00:00', TIMESTAMP '2025-01-02 00:00:00'
  ),
  (
    'audit-current-user-2', ' Legacy@Example.invalid ',
    '$2a$12$' || repeat('b', 53), 'Audit', 'Two', 'CUSTOMER', NULL,
    (:'fixture_grace_deadline'::timestamptz AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 minute',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 1,
    TIMESTAMP '2025-02-01 00:00:00', TIMESTAMP '2025-02-01 00:00:00'
  ),
  (
    'audit-current-user-3', 'legacy@example.invalid',
    '$2b$12$' || repeat('c', 53), 'Audit', 'Three', 'CUSTOMER', NULL,
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 day',
    NULL, CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 1,
    TIMESTAMP '2025-03-01 00:00:00', TIMESTAMP '2025-03-01 00:00:00'
  ),
  (
    'audit-current-user-4', 'not-an-email',
    '$2y$12$' || repeat('z', 53),
    'Audit', 'Four', 'CUSTOMER', NULL, NULL, NULL, NULL, NULL,
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day'
  ),
  (
    'audit-current-user-5', 'admin@example.invalid',
    '$2a$12$' || repeat('d', 53), 'Audit', 'Five', 'ADMIN', NULL,
    (:'fixture_grace_deadline'::timestamptz AT TIME ZONE 'UTC'),
    NULL, NULL, NULL,
    TIMESTAMP '2025-05-01 00:00:00', TIMESTAMP '2025-05-01 00:00:00'
  ),
  (
    'audit-current-user-6', 'operator@example.invalid',
    '$2a$12$' || repeat('e', 53), 'Audit', 'Six', 'OPERATOR',
    TIMESTAMP '2025-05-01 00:00:00',
    (:'fixture_grace_deadline'::timestamptz AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 minute',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 2,
    TIMESTAMP '2025-06-01 00:00:00', TIMESTAMP '2025-06-01 00:00:00'
  ),
  (
    'audit-current-user-7', 'future@example.invalid',
    '$2a$12$' || repeat('f', 53), 'Audit', 'Seven', 'CUSTOMER',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day',
    NULL, NULL, NULL, NULL,
    TIMESTAMP '2025-07-01 00:00:00', TIMESTAMP '2025-07-01 00:00:00'
  ),
  (
    'audit-current-user-8', 'post-cutoff@example.invalid',
    '$2a$12$' || repeat('g', 53), 'Audit', 'Eight', 'CUSTOMER', NULL,
    'infinity',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day 1 minute',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day', 1,
    (:'fixture_legacy_cutoff'::timestamptz AT TIME ZONE 'UTC'),
    (:'fixture_legacy_cutoff'::timestamptz AT TIME ZONE 'UTC')
  ),
  (
    'audit-current-user-9', 'legacy-no-grace@example.invalid',
    '$2a$10$' || repeat('h', 53), 'Audit', 'Nine', 'CUSTOMER', NULL,
    NULL, NULL, NULL, NULL,
    TIMESTAMP '2025-09-01 00:00:00', TIMESTAMP '2025-09-01 00:00:00'
  ),
  (
    'audit-current-user-10', 'nonfinite-created@example.invalid',
    '$2a$12$' || repeat('i', 53), 'Audit', 'Ten', 'CUSTOMER', NULL,
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '31 days',
    NULL, NULL, NULL,
    '-infinity', '-infinity'
  );

INSERT INTO public."EmailVerification" (
  id, "userId", token, "tokenHash", expires, "createdAt"
)
VALUES
  (
    'audit-current-token-1', 'audit-current-user-2', repeat('a', 64),
    'v1:' || repeat('1', 64),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  ),
  (
    'audit-current-token-2', 'audit-current-user-3', repeat('b', 64), NULL,
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 hour',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '2 hours'
  ),
  (
    'audit-current-token-3', 'audit-current-user-6', 'bad-token',
    'BAD-HASH', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '2 hours',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  ),
  (
    'audit-current-token-4', 'audit-current-user-8', repeat('c', 64),
    'v1:' || repeat('2', 64),
    'infinity', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  );

INSERT INTO public."Session" (
  id, "sessionToken", "userId", expires
)
VALUES (
  'audit-current-session-1', 'audit-current-session-token-1',
  'audit-current-user-4',
  (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour'
);

INSERT INTO public."PasswordReset" (
  id, "userId", token, "tokenHash", expires
)
VALUES (
  'audit-current-reset-1', 'audit-current-user-5', repeat('d', 64),
  'v1:' || repeat('3', 64),
  (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour'
);

INSERT INTO public."Promotion" (
  id, name, type, value, "startDate", "endDate", "updatedAt"
)
VALUES (
  'audit-current-promotion-1', 'Audit current promotion',
  'FIXED_AMOUNT_OFF', 1, TIMESTAMP '2025-01-01 00:00:00',
  TIMESTAMP '2027-01-01 00:00:00', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

INSERT INTO public."CouponUsage" (
  id, "promotionId", "userId", "usedAt"
)
VALUES (
  'audit-current-coupon-1', 'audit-current-promotion-1',
  'audit-current-user-9', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

INSERT INTO public."Order" (
  id, "orderNumber", "userId", "shippingStreet", "shippingCity",
  "shippingPostal", "paymentMethod", subtotal, shipping, total,
  "promotionIds", "updatedAt"
)
VALUES (
  'audit-current-order-1', 'AUDIT-CURRENT-1', 'audit-current-user-2',
  'Fixture 1', 'Fixture', '11000', 'CASH', 100, 0, 100, '{}',
  CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

INSERT INTO public."Address" (
  id, "userId", street, city, "postalCode"
)
VALUES (
  'audit-current-address-1', 'audit-current-user-3', 'Fixture 2',
  'Fixture', '11000'
);

INSERT INTO public."Wishlist" (
  id, "userId", "externalProductId"
)
VALUES (
  'audit-current-wishlist-1', 'audit-current-user-3', 'fixture-product'
);

INSERT INTO public."ProductReview" (
  id, "productCode", "userId", rating, "updatedAt"
)
VALUES (
  'audit-current-review-1', 'FIXTURE-PRODUCT', 'audit-current-user-3', 5,
  CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

COMMIT;
