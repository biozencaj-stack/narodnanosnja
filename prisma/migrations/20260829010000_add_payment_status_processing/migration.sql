-- Jedna enum vrednost po migraciji zbog PostgreSQL 11 kompatibilnosti.
SET search_path = public, pg_catalog;

ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING' AFTER 'PENDING';
