-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 75: Person type (natural/legal) en persons
-- Agrega person_type y business_name para distinguir
-- personas naturales (nombre + apellido) de jurídicas (razón social).
-- ═══════════════════════════════════════════════════════════════

-- Agregar columnas
ALTER TABLE persons ADD COLUMN IF NOT EXISTS person_type TEXT NOT NULL DEFAULT 'natural';
ALTER TABLE persons ADD COLUMN IF NOT EXISTS business_name TEXT;

-- Crear índice por tipo
CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(person_type);

-- Backfill: todas las personas sin apellido son jurídicas (legal)
UPDATE persons
SET
  person_type = 'legal',
  business_name = first_name,
  last_name = NULL
WHERE last_name IS NULL OR last_name = '';

-- Las personas con apellido son naturales
UPDATE persons
SET
  person_type = 'natural',
  business_name = NULL
WHERE last_name IS NOT NULL AND last_name != '';
