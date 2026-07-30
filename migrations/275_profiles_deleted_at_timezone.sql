-- ═══════════════════════════════════════════════════════════════
-- Migration 275: profiles — deleted_at y timezone
--
-- - deleted_at: marca de eliminación suave. NULL = activo o solo
--   desactivado. NOT NULL = eliminado (no aparece en lista principal).
-- - timezone: zona horaria del usuario. Se deriva del país al invitar
--   (Chile → America/Santiago) y el admin puede sobreescribirla.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN profiles.deleted_at IS 'Fecha de eliminación suave. NULL = no eliminado.';
COMMENT ON COLUMN profiles.timezone IS 'Zona horaria IANA (ej: America/Santiago). Derivada del país, overrideable por admin.';
