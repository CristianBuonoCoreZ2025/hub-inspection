-- ═════════════════════════════════════════════════════════════════
-- Migration 254: sync_workflow_for_claim — no crear duplicados si ya hay resueltas
--
-- Problema: sync_workflow_for_claim contaba solo acciones "no resueltas"
-- para determinar duplicados. Cuando todas las CIN estaban issued (resueltas),
-- el count era 0 → creaba una nueva CIN cada vez que se cargaba la página
-- del siniestro (el frontend llama a /api/workflows/sync-claim en cada load).
--
-- Esto causó que se creara HCIN-005 automáticamente al abrir el siniestro
-- L-141, sin que el usuario pidiera una nueva coordinación.
--
-- Solución: cambiar el check de duplicados para contar TODAS las acciones
-- no rechazadas (incluyendo resueltas/issued). Si ya existe una CIN emitida,
-- no crear otra. La recreación por rechazo la maneja
-- auto_recreate_rejected_workflow_action (trigger separado).
--
-- Solo sync_workflow_for_claim se modifica. auto_recreate_rejected_workflow_action
-- y cascade_workflow_on_issue mantienen su lógica de "no resuelta" de migración 252
-- (esas SÍ necesitan distinguir resueltas de activas para permitir recreación
--  manual y cascada de hijos).
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_workflow_for_claim(p_claim_id UUID)
RETURNS TABLE(action_template_id UUID, name TEXT, created BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_claim RECORD;
  v_config RECORD;
  v_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_step_code VARCHAR(50);
  v_template_line UUID;
  v_features_code TEXT;
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
      SELECT at.code, at.line_business_id, af.code
      INTO v_step_code, v_template_line, v_features_code
      FROM action_template at
      LEFT JOIN action_features af ON af.id = at.action_features_id
      WHERE at.id = v_step.action_template_id;

      -- Saltar si el template no coincide con la línea del claim
      IF v_template_line IS NOT NULL AND v_template_line != v_claim.business_line_id THEN
        CONTINUE;
      END IF;

      -- Excepción GEN: la característica genérica puede tener varias pendientes
      IF v_features_code = 'GEN' THEN
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
        CONTINUE;
      END IF;

      -- No duplicar: verificar por CÓDIGO y contar TODAS las no rechazadas
      -- (incluyendo resueltas/issued — no crear otra si ya existe una emitida).
      -- La recreación por rechazo la maneja auto_recreate_rejected_workflow_action.
      SELECT count(*) INTO v_existing_count
      FROM claim_actions ca
      JOIN action_template at ON at.id = ca.action_template_id
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = p_claim_id
        AND at.code = v_step_code
        AND ca.is_active = true
        AND lc.code != 'rejected';

      IF v_existing_count = 0 THEN
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
      ELSE
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sync_workflow_for_claim IS
'Create level-1 workflow actions for a claim. Duplicate prevention: count ALL non-rejected actions (including resolved/issued). GEN feature allows multiple pending. Migration 254.';
