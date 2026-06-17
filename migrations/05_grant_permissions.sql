-- ============================================================
-- Hub Inspections — Permisos masivos para rol 'user'
-- Ejecutar en: Hasura Console → Data → SQL
-- ============================================================

-- 1. Crear rol 'user' si no existe (rol por defecto de Nhost Auth en Hasura)
--    NOTA: 'user' es una palabra reservada en PostgreSQL, usar comillas dobles.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'user') THEN
    CREATE ROLE "user" NOLOGIN;
  END IF;
END
$$;

-- 2. Permisos PostgreSQL para el rol 'user'
GRANT USAGE ON SCHEMA public TO "user";

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO "user";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO "user";

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO "user";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES
  TO "user";

-- ============================================================
-- 2. Hasura GraphQL Permissions (Metadata API)
--    Esto NO se puede ejecutar como SQL directo en PostgreSQL.
--    Usar el script: pnpm tsx scripts/setup-hasura-permissions.ts
--    (necesita HASURA_ADMIN_SECRET en .env.local)
-- ============================================================
