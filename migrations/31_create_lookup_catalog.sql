-- ============================================================
-- Hub Inspections — Migracion 31: Crear lookup_catalog
-- Unifica catálogos genericos por pais: tipo construccion, destino, daño, habitabilidad, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS lookup_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lookup_catalog IS 'Catalogos genericos por pais: construction_type, destination, damage_classification, habitability, status, type, currency, etc.';

-- Constraint unica: un codigo+name por categoria y pais
CREATE UNIQUE INDEX IF NOT EXISTS idx_lookup_unique
  ON lookup_catalog(category, COALESCE(code, name), country_id)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lookup_unique_no_code
  ON lookup_catalog(category, name, country_id)
  WHERE code IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lookup_category ON lookup_catalog(category);
CREATE INDEX IF NOT EXISTS idx_lookup_country ON lookup_catalog(country_id);
CREATE INDEX IF NOT EXISTS idx_lookup_active ON lookup_catalog(is_active);

-- Trigger updated_at
DROP TRIGGER IF EXISTS lookup_catalog_updated_at ON lookup_catalog;
CREATE TRIGGER lookup_catalog_updated_at BEFORE UPDATE ON lookup_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Seed: poblar lookup_catalog con datos existentes de tablas separadas
-- ============================================================

-- 1. construction_types → lookup_catalog(category='construction_type')
INSERT INTO lookup_catalog (country_id, category, name, is_active)
SELECT DISTINCT
  (SELECT id FROM countries WHERE code = 'CL'),
  'construction_type',
  construction_type,
  true
FROM claims
WHERE construction_type IS NOT NULL AND construction_type != ''
ON CONFLICT DO NOTHING;

-- 2. housing_destinations → lookup_catalog(category='housing_destination')
INSERT INTO lookup_catalog (country_id, category, name, is_active)
SELECT DISTINCT
  (SELECT id FROM countries WHERE code = 'CL'),
  'housing_destination',
  destination,
  true
FROM claims
WHERE destination IS NOT NULL AND destination != ''
ON CONFLICT DO NOTHING;

-- 3. damage_classifications → lookup_catalog(category='damage_classification')
INSERT INTO lookup_catalog (country_id, category, name, is_active)
SELECT DISTINCT
  (SELECT id FROM countries WHERE code = 'CL'),
  'damage_classification',
  damage_classification,
  true
FROM claims
WHERE damage_classification IS NOT NULL AND damage_classification != ''
ON CONFLICT DO NOTHING;

-- 4. Habitability (is_habitable) → lookup_catalog(category='habitability')
INSERT INTO lookup_catalog (country_id, category, code, name, is_active) VALUES
  ((SELECT id FROM countries WHERE code = 'CL'), 'habitability', 'yes', 'Habitable', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'habitability', 'no', 'No Habitable', true)
ON CONFLICT DO NOTHING;

-- 5. claim_status → lookup_catalog(category='claim_status')
INSERT INTO lookup_catalog (country_id, category, code, name, is_active) VALUES
  ((SELECT id FROM countries WHERE code = 'CL'), 'claim_status', 'created', 'Creado', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'claim_status', 'scheduled', 'Despachado', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'claim_status', 'in_progress', 'En Progreso', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'claim_status', 'in_review', 'En Revisión', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'claim_status', 'closed', 'Cerrado', true)
ON CONFLICT DO NOTHING;
