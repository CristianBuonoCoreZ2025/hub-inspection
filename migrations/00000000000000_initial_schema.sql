-- ============================================================
-- Hub Inspections — Schema para Nhost / Hasura
-- ============================================================
-- Notas:
-- 1. Hasura debe "track" estas tablas después de ejecutar la migración.
-- 2. Los permisos de acceso se configuran en Hasura Console
--    (o via Hasura metadata), además de RLS PostgreSQL.
-- 3. Las relaciones (FK) permiten que Hasura genere campos
--    GraphQL automáticos (ej: assigned_adjuster).
-- ============================================================


