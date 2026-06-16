-- ============================================================
-- Agregar campos faltantes a tabla companies existente
-- Ejecutar en Hasura Console → Data → SQL
-- ============================================================

-- Agregar columnas nuevas (si no existen)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rut TEXT UNIQUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
