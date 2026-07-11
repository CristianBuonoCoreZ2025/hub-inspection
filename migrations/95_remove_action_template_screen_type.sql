-- ═══════════════════════════════════════════════════════════════
-- 95: Eliminar screen_type_id de action_template
-- La pantalla se asocia a la característica (action_feature.screen_id),
-- no a la gestión (action_template).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE action_template
  DROP COLUMN IF EXISTS screen_type_id;

-- La tabla gestion_screen_types sigue existiendo pero ya no se usa vía action_template.
-- Se mantiene por compatibilidad con gestion_screens (si aplica).
