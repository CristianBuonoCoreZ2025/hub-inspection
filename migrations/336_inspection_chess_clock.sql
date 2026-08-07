-- Migration 336: Modelo de reloj de ajedrez para inspecciones
--
-- Permite múltiples pausas/reanudaciones durante una inspección activa.
-- El status 'paused' indica que la inspección está detenida temporalmente.
-- El inspector puede ver la info pero no modificar nada hasta reanudar.
--
-- Cambios:
-- 1. inspection_pauses.resumed_at ahora es nullable (NULL mientras está pausada).
-- 2. inspection_sessions.status agrega 'paused' al CHECK.
-- 3. Índice para encontrar la pausa abierta rápidamente.

-- 1. Hacer resumed_at nullable (ya tiene datos de migración 335 con valor fijo)
ALTER TABLE inspection_pauses ALTER COLUMN resumed_at DROP NOT NULL;

-- 2. Agregar 'paused' al CHECK de inspection_sessions
ALTER TABLE inspection_sessions DROP CONSTRAINT IF EXISTS inspection_sessions_status_check;
ALTER TABLE inspection_sessions ADD CONSTRAINT inspection_sessions_status_check
  CHECK (status IN ('pending','scheduled','active','paused','completed','cancelled'));

-- 3. Índice para encontrar la pausa abierta (resumed_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_inspection_pauses_open
  ON inspection_pauses(inspection_session_id)
  WHERE resumed_at IS NULL;
