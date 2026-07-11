-- ═══════════════════════════════════════════════════════════════
-- 116: claim_actions.is_automatic — distinguir gestiones manuales vs automáticas
--
-- Reglas de negocio:
--   is_automatic = false → gestión manual (creada por usuario vía "Nueva Gestión")
--     → Se puede eliminar (soft delete) SOLO si está pendiente (action_status.code = 'todo')
--   is_automatic = true  → gestión automática (creada por workflow al asignar
--     línea de negocio + país + evento)
--     → NO se puede eliminar
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE claim_actions
  ADD COLUMN IF NOT EXISTS is_automatic boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN claim_actions.is_automatic IS
  'true = creación automática por workflow (no eliminable); false = manual (eliminable si está pendiente)';

-- Backfill: todas las gestiones existentes son manuales (creadas por usuarios)
-- Las futuras creadas por workflow deberán setear is_automatic = true explícitamente.
