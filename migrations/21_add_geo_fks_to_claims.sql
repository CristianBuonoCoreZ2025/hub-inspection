-- ============================================================
-- Hub Inspections — Migracion 21: Agregar FKs geograficas a claims
-- ============================================================

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commune_id UUID REFERENCES communes(id) ON DELETE SET NULL;
