-- ============================================================
-- Hub Inspections — Migracion 36: Eliminar columnas de idioma _es, _en, _pt
-- Los idiomas ya no se manejan con columnas separadas
-- ============================================================

-- claim_types
ALTER TABLE claim_types DROP COLUMN IF EXISTS name_es;
ALTER TABLE claim_types DROP COLUMN IF EXISTS name_en;
ALTER TABLE claim_types DROP COLUMN IF EXISTS name_pt;

-- damage_classifications
ALTER TABLE damage_classifications DROP COLUMN IF EXISTS name_en;
ALTER TABLE damage_classifications DROP COLUMN IF EXISTS name_pt;

-- housing_destinations
ALTER TABLE housing_destinations DROP COLUMN IF EXISTS name_es;
ALTER TABLE housing_destinations DROP COLUMN IF EXISTS name_en;
ALTER TABLE housing_destinations DROP COLUMN IF EXISTS name_pt;

-- property_classifications
ALTER TABLE property_classifications DROP COLUMN IF EXISTS name_es;
ALTER TABLE property_classifications DROP COLUMN IF EXISTS name_en;
ALTER TABLE property_classifications DROP COLUMN IF EXISTS name_pt;

-- relationships
ALTER TABLE relationships DROP COLUMN IF EXISTS name_es;
ALTER TABLE relationships DROP COLUMN IF EXISTS name_en;
ALTER TABLE relationships DROP COLUMN IF EXISTS name_pt;
