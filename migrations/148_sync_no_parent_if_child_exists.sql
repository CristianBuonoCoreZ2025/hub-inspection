-- Migration 148: sync_workflow_for_claim — no crear padre si el hijo ya existe
--
-- Regla: si una gestión de nivel 1 tiene hijos en el workflow (otros steps
-- que depends_on_template_id = este template), y alguno de esos hijos ya
-- existe como gestión activa NO rechazada en el claim, NO crear el padre.
-- El hijo ya está en proceso, crear el padre retroactivamente no tiene sentido.

CREATE OR REPLACE FUNCTION sync_workflow_for_claim(p_claim_id UUID)
RETURNS TABLE(action_template_id UUID, name TEXT, created BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_claim RECORD;
  v_config RECORD;
  v_step RECORD;
  v_child_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_child_existing_count INT;
BEGIN
  SELECT status_id, business_line_id, country_id, event_id
  INTO v_claim
  FROM claims WHERE id = p_claim_id;

  IF v_claim.status_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_todo_status
  FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  FOR v_config IN
    SELECT wc.* FROM workflow_configs wc
    WHERE wc.claim_status_id = v_claim.status_id
      AND wc.status = 'online'
      AND wc.business_line_id = v_claim.business_line_id
      AND wc.country_id = v_claim.country_id
      AND wc.event_id = v_claim.event_id
  LOOP
    FOR v_step IN
      SELECT ws.* FROM workflow_steps ws
      WHERE ws.workflow_config_id = v_config.id
        AND ws.is_automatic = true
        AND ws.level = 1
        AND ws.depends_on_template_id IS NULL
      ORDER BY ws.sort_order
    LOOP
      -- No duplicar: solo cuenta gestiones activas NO rechazadas
      SELECT count(*) INTO v_existing_count
      FROM claim_actions ca
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = p_claim_id
        AND ca.action_template_id = v_step.action_template_id
        AND ca.is_active = true
        AND lc.code != 'rejected';

      IF v_existing_count > 0 THEN
        -- Ya existe una gestión activa no rechazada de este template
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
        CONTINUE;
      END IF;

      -- NUEVO: verificar si algún hijo ya existe en proceso
      -- Si el hijo ya está activo (no rechazado), no crear el padre retroactivamente
      v_child_existing_count := 0;
      FOR v_child_step IN
        SELECT ws_child.* FROM workflow_steps ws_child
        WHERE ws_child.workflow_config_id = v_config.id
          AND ws_child.depends_on_template_id = v_step.action_template_id
      LOOP
        SELECT count(*) INTO v_child_existing_count
        FROM claim_actions ca
        JOIN lookup_catalog lc ON lc.id = ca.action_status_id
        WHERE ca.claim_id = p_claim_id
          AND ca.action_template_id = v_child_step.action_template_id
          AND ca.is_active = true
          AND lc.code != 'rejected';

        IF v_child_existing_count > 0 THEN
          -- El hijo ya existe, no crear el padre
          EXIT;
        END IF;
      END LOOP;

      IF v_child_existing_count > 0 THEN
        -- Saltar este padre: su hijo ya está en proceso
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
        CONTINUE;
      END IF;

      -- Crear la gestión
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on
      )
      SELECT
        p_claim_id, v_step.action_template_id, at.action_features_id,
        at.line_business_id, at.name, v_todo_status,
        true, true, 'W', NULL, now()
      FROM action_template at WHERE at.id = v_step.action_template_id;

      RETURN QUERY
        SELECT v_step.action_template_id, at.name, true
        FROM action_template at WHERE at.id = v_step.action_template_id;
    END LOOP;
  END LOOP;
END;
$$;
