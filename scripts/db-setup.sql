-- Generic PostgreSQL bootstrap for a single webshop deployment.
--
-- No production credential belongs in this file or in Git history.
-- Supply all values from a protected operator session or secret manager:
--
--   sudo -u postgres psql \
--     --set=app_user=webshop_app \
--     --set=app_database=webshop \
--     --set=app_password='VALUE_FROM_SECRET_MANAGER' \
--     --file=scripts/db-setup.sql
--
-- Use simple PostgreSQL-safe identifiers for app_user and app_database.

\set ON_ERROR_STOP on

\if :{?app_user}
\else
  \echo 'Missing required psql variable: app_user'
  \quit
\endif

\if :{?app_database}
\else
  \echo 'Missing required psql variable: app_database'
  \quit
\endif

\if :{?app_password}
\else
  \echo 'Missing required psql variable: app_password'
  \quit
\endif

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = :'app_user'
) \gexec

SELECT format(
  'CREATE DATABASE %I OWNER %I',
  :'app_database',
  :'app_user'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = :'app_database'
) \gexec

\connect :app_database

GRANT ALL ON SCHEMA public TO :"app_user";

\echo 'Database and application role are ready.'
\echo 'Build DATABASE_URL outside this script and store it only as a secret.'
