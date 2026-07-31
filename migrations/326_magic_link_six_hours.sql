-- ═════════════════════════════════════════════════════════════════
-- Migration 326: Magic link a 6 horas y reparación de sesiones
--
-- Cambia la ventana por defecto a 6 horas antes/después de scheduled_at
-- y repara las inspecciones remotas vigentes (scheduled/active) para
-- que su magic_link_expires_at refleje el nuevo rango.
--
-- No borra datos.
-- ═════════════════════════════════════════════════════════════════

-- 1. Valor por defecto a 6 horas
UPDATE system_settings
SET value = '6',
    updated_at = now()
WHERE key = 'magic_link_window_hours';

-- 2. Reparar sesiones activas o agendadas con scheduled_at
UPDATE inspection_sessions
SET
  magic_link_expires_at = GREATEST(now(), scheduled_at::timestamptz) + interval '6 hours',
  magic_link_extended = false,
  updated_at = now()
WHERE
  inspection_type = 'remote'
  AND status IN ('scheduled', 'active')
  AND scheduled_at IS NOT NULL;

INSERT INTO _migrations (filename) VALUES ('326_magic_link_six_hours.sql')
ON CONFLICT (filename) DO NOTHING;
