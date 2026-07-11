-- ═══════════════════════════════════════════════════════════════
-- Migración 114: coverage_catalog.country_id
--
-- Las coberturas son por país. El match se hace con el país de la
-- compañía de seguros seleccionada en la póliza.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar country_id a coverage_catalog
ALTER TABLE coverage_catalog ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES countries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coverage_catalog_country ON coverage_catalog(country_id);

-- 2. Setear todas las coberturas existentes a Chile (id_pais=111 en legacy = Chile)
UPDATE coverage_catalog SET country_id = (SELECT id FROM countries WHERE code = 'CL')
WHERE country_id IS NULL;

-- 3. Hacer que el combo funcione: índice compuesto para buscar por país + tema
CREATE INDEX IF NOT EXISTS idx_coverage_catalog_country_theme
  ON coverage_catalog(country_id, theme) WHERE is_active = true;
