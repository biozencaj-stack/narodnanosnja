\set ON_ERROR_STOP on

BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'auth_audit_legacy_provera' THEN
    RAISE EXCEPTION 'Refusing auth audit fixture outside its isolated test database';
  END IF;
END;
$guard$;

INSERT INTO public."User" (
  id, email, "passwordHash", "firstName", "lastName", role,
  "emailVerified", "createdAt", "updatedAt"
)
VALUES
  (
    'audit-legacy-user-1', 'verified@example.invalid',
    '$2a$12$' || repeat('a', 53), 'Audit', 'One', 'CUSTOMER',
    TIMESTAMP '2025-01-02 00:00:00', TIMESTAMP '2025-01-01 00:00:00',
    TIMESTAMP '2025-01-02 00:00:00'
  ),
  (
    'audit-legacy-user-2', ' Legacy@Example.invalid ',
    '$2a$12$' || repeat('b', 53), 'Audit', 'Two', 'CUSTOMER',
    NULL, TIMESTAMP '2025-02-01 00:00:00', TIMESTAMP '2025-02-01 00:00:00'
  ),
  (
    'audit-legacy-user-3', 'legacy@example.invalid',
    '$2b$10$' || repeat('c', 53), 'Audit', 'Three', 'CUSTOMER',
    NULL, TIMESTAMP '2025-03-01 00:00:00', TIMESTAMP '2025-03-01 00:00:00'
  ),
  (
    'audit-legacy-user-4', 'not-an-email',
    '$2y$12$' || repeat('z', 53), 'Audit', 'Four', 'CUSTOMER',
    NULL, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day'
  ),
  (
    'audit-legacy-user-5', 'admin@example.invalid',
    '$2a$12$' || repeat('d', 53), 'Audit', 'Five', 'ADMIN',
    NULL, TIMESTAMP '2025-05-01 00:00:00', TIMESTAMP '2025-05-01 00:00:00'
  ),
  (
    'audit-legacy-user-6', 'operator@example.invalid',
    '$2a$12$' || repeat('e', 53), 'Audit', 'Six', 'OPERATOR',
    TIMESTAMP '2025-05-01 00:00:00', TIMESTAMP '2025-06-01 00:00:00',
    TIMESTAMP '2025-06-01 00:00:00'
  ),
  (
    'audit-legacy-user-7', 'future@example.invalid',
    '$2a$12$' || repeat('f', 53), 'Audit', 'Seven', 'CUSTOMER',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 day',
    TIMESTAMP '2025-07-01 00:00:00', TIMESTAMP '2025-07-01 00:00:00'
  );

INSERT INTO public."EmailVerification" (
  id, "userId", token, expires, "createdAt"
)
VALUES
  (
    'audit-legacy-token-1', 'audit-legacy-user-2', repeat('a', 64),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  ),
  (
    'audit-legacy-token-2', 'audit-legacy-user-3', repeat('b', 64),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 hour',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '2 hours'
  ),
  (
    'audit-legacy-token-3', 'audit-legacy-user-6', 'bad-token',
    'infinity', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  );

INSERT INTO public."Session" (
  id, "sessionToken", "userId", expires
)
VALUES (
  'audit-legacy-session-1', 'audit-legacy-session-token-1',
  'audit-legacy-user-4',
  (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour'
);

INSERT INTO public."PasswordReset" (
  id, "userId", token, expires
)
VALUES (
  'audit-legacy-reset-1', 'audit-legacy-user-5', repeat('c', 64),
  (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 hour'
);

INSERT INTO public."Promotion" (
  id, name, type, value, "startDate", "endDate", "updatedAt"
)
VALUES (
  'audit-legacy-promotion-1', 'Audit legacy promotion', 'FIXED_AMOUNT_OFF',
  1, TIMESTAMP '2025-01-01 00:00:00', TIMESTAMP '2027-01-01 00:00:00',
  CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

INSERT INTO public."CouponUsage" (
  id, "promotionId", "userId", "usedAt"
)
VALUES (
  'audit-legacy-coupon-1', 'audit-legacy-promotion-1',
  'audit-legacy-user-5', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

INSERT INTO public."Order" (
  id, "orderNumber", "userId", "shippingStreet", "shippingCity",
  "shippingPostal", "paymentMethod", subtotal, shipping, total,
  "promotionIds", "updatedAt"
)
VALUES (
  'audit-legacy-order-1', 'AUDIT-LEGACY-1', 'audit-legacy-user-2',
  'Fixture 1', 'Fixture', '11000', 'CASH', 100, 0, 100, '{}',
  CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

INSERT INTO public."Address" (
  id, "userId", street, city, "postalCode"
)
VALUES (
  'audit-legacy-address-1', 'audit-legacy-user-3', 'Fixture 2',
  'Fixture', '11000'
);

INSERT INTO public."Wishlist" (
  id, "userId", "externalProductId"
)
VALUES (
  'audit-legacy-wishlist-1', 'audit-legacy-user-3', 'fixture-product'
);

INSERT INTO public."ProductReview" (
  id, "productCode", "userId", rating, "updatedAt"
)
VALUES (
  'audit-legacy-review-1', 'FIXTURE-PRODUCT', 'audit-legacy-user-3', 5,
  CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

COMMIT;
