-- ═══════════════════════════════════════════════════════════════
-- Migración 190: Agregar screen_snapshot a claim_actions
-- ═══════════════════════════════════════════════════════════════
--
-- PROPÓSITO:
-- Cuando se crea una claim_action (gestión), se copia la estructura
-- de la pantalla (form_schema del gestion_screen asociado al action_feature)
-- dentro de la acción. Esto "congela" la estructura con la que nació la
-- gestión, de modo que si alguien después edita la pantalla (agrega,
-- quita o reordena campos), las gestiones ya creadas siguen funcionando
-- con la estructura que tenían al momento de su creación.
--
-- Esto garantiza que las dinámicas siempre funcionen, aún cuando la
-- pantalla cambie en el futuro.
--
-- ESTRUCTURA:
--   screen_snapshot: jsonb — copia del form_schema del gestion_screen
--   screen_snapshot_at: timestamptz — fecha en que se tomó el snapshot
--
-- COMPATIBILIDAD:
--   - Las claim_actions existentes quedan con screen_snapshot = NULL.
--   - El frontend usa screen_snapshot si existe; si es NULL, hace fallback
--     al form_schema actual del gestion_screen (mismo comportamiento de antes).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE claim_actions
  ADD COLUMN IF NOT EXISTS screen_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS screen_snapshot_at timestamptz;

COMMENT ON COLUMN claim_actions.screen_snapshot IS
  'Snapshot del form_schema del gestion_screen al momento de crear la acción. Permite que la gestión funcione con la estructura original aunque la pantalla cambie después.';

COMMENT ON COLUMN claim_actions.screen_snapshot_at IS
  'Fecha en que se tomó el screen_snapshot (igual a created_on en la mayoría de los casos).';
