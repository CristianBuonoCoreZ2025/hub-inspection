-- ═══════════════════════════════════════════════════════════════
-- Migration 276: Unique indexes parciales para email y rut en profiles
--
-- - email único entre no eliminados (deleted_at IS NULL)
-- - rut único entre no eliminados y no nulos
--
-- Parciales para no bloquear re-invitaciones de usuarios eliminados
-- y para permitir múltiples NULL en rut.
-- ═══════════════════════════════════════════════════════════════

-- Email único (solo entre no eliminados)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_active
  ON profiles(lower(email)) WHERE deleted_at IS NULL;

-- RUT único (solo entre no eliminados y no nulos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_rut_active
  ON profiles(rut) WHERE rut IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX uq_profiles_email_active IS 'Email único entre usuarios no eliminados. Case-insensitive.';
COMMENT ON INDEX uq_profiles_rut_active IS 'RUT único entre usuarios no eliminados con RUT no nulo.';
