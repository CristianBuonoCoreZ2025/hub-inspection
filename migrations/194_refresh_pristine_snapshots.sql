-- ═══════════════════════════════════════════════════════════════
-- Migración 194: Función refresh_pristine_snapshots
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEMA:
-- Cuando se edita una pantalla en el editor, las gestiones existentes
-- siguen usando el snapshot con el que nacieron (screen_snapshot).
-- Para que una gestión use la nueva pantalla, hoy se borra y se recrea,
-- pero eso pierde los IDs, las asignaciones de responsables, etc.
--
-- REGLA DEL DIRECTOR:
-- - Si la gestión NO tiene datos guardados (action_data vacío) Y NO ha
--   sido emitida (status = 'todo') → es "prístina" y puede refrescar
--   su snapshot a la pantalla más reciente del editor.
-- - Si la gestión tiene aunque sea un campo guardado, o fue emitida/
--   revisada/aprobada/rechazada → debe mantener su snapshot original
--   para evitar inconsistencias entre los datos ya capturados y la
--   nueva estructura de pantalla.
--
-- SOLUCIÓN:
-- Función refresh_pristine_snapshots(p_claim_id) que:
-- 1. Busca las gestiones del claim que son prístinas
--    (action_data IS NULL o '{}' y action_status = 'todo')
-- 2. Para cada una, busca la pantalla vinculada (via action_features
--    → screen_id) y copia el form_schema actual al screen_snapshot
-- 3. Retorna cuántas gestiones se refrescaron
--
-- Es segura: solo toca gestiones sin datos, sin emitir.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_pristine_snapshots(p_claim_id UUID)
RETURNS TABLE(action_id UUID, template_code TEXT, refreshed BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_action RECORD;
  v_screen RECORD;
  v_schema JSONB;
  v_is_pristine BOOLEAN;
BEGIN
  FOR v_action IN
    SELECT ca.id, ca.action_data, ca.action_status_id, at.code as template_code,
           af.screen_id
    FROM claim_actions ca
    JOIN action_template at ON ca.action_template_id = at.id
    LEFT JOIN action_features af ON at.action_features_id = af.id
    WHERE (p_claim_id IS NULL OR ca.claim_id = p_claim_id)
  LOOP
    -- Es prístina? action_data vacío Y status = todo
    v_is_pristine := (
      (v_action.action_data IS NULL
       OR v_action.action_data::text = '{}'
       OR v_action.action_data::text = 'null')
      AND EXISTS (
        SELECT 1 FROM lookup_catalog lc
        WHERE lc.id = v_action.action_status_id
        AND lc.category = 'action_status'
        AND lc.code = 'todo'
      )
    );

    IF NOT v_is_pristine THEN
      action_id := v_action.id;
      template_code := v_action.template_code;
      refreshed := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Buscar la pantalla vinculada
    IF v_action.screen_id IS NULL THEN
      action_id := v_action.id;
      template_code := v_action.template_code;
      refreshed := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT form_schema INTO v_schema
    FROM gestion_screens WHERE id = v_action.screen_id;

    IF v_schema IS NULL THEN
      action_id := v_action.id;
      template_code := v_action.template_code;
      refreshed := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Refrescar el snapshot con el form_schema actual
    UPDATE claim_actions
    SET screen_snapshot = v_schema
    WHERE id = v_action.id;

    action_id := v_action.id;
    template_code := v_action.template_code;
    refreshed := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Comentario
COMMENT ON FUNCTION refresh_pristine_snapshots IS
'Resfresca el screen_snapshot de gestiones prístinas (sin datos, status=todo) con el form_schema actual de la pantalla vinculada. Gestiones con datos o emitidas no se tocan.';
