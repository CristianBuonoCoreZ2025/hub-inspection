-- ═══════════════════════════════════════════════════════════════
-- 123: Campos adicionales en profiles (nombre, apellido, rut, país)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rut text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES countries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_rut ON profiles(rut) WHERE rut IS NOT NULL;
