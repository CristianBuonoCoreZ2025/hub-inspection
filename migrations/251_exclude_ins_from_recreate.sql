-- ═════════════════════════════════════════════════════════════════
-- Migration 251: Excluir gestiones con característica INS (Inspección)
-- del trigger auto_recreate_rejected_workflow_action
--
-- Problema: auto_recreate_rejected_workflow_action recrea automáticamente
-- cualquier gestión marcada como is_required=true cuando se rechaza.
-- Pero la regla de is_required SOLO aplica cuando el usuario apreta
-- físicamente el botón de rechazo en una gestión DINÁMICA (pantalla con
-- review_levels). Las gestiones de pantalla FIJA (como INS - Inspección)
-- nunca tienen botón de rechazo en la UI, así que nunca deberían ser
-- recreadas por este trigger.
--
-- Además, el reagendamiento de inspecciones rechaza la INS anterior
-- programáticamente para reabrir el flujo. Si el trigger la recrea,
-- se crea una INS vacía + sesión vacía, rompiendo el flujo.
--
-- Solución: Excluir las gestiones cuyo action_features.code = 'INS'
-- del trigger auto_recreate_rejected_workflow_action.
--
-- No se modifican datos, solo la función trigger.
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_recreate_rejected_workflow_action()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_template_code VARCHAR(50);
  v_todo_status UUID;
  v_is_rejected BOOLEAN;
  v_step RECORD;
  v_config RECORD;
  v_existing_count INT;
  v_claim_business_line UUID;
  v_features_code TEXT;
BEGIN
  IF NEW.action_status_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.action_status_id = OLD.action_status_id THEN RETURN NEW; END IF;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  SELECT (lc.code = 'rejected') INTO v_is_rejected
  FROM lookup_catalog lc WHERE lc.id = NEW.action_status_id;
  IF NOT v_is_rejected THEN RETURN NEW; END IF;

  -- ── Excluir gestiones con característica INS (pantalla fija) ──
  -- La regla de is_required SOLO aplica a gestiones dinámicas (con botón
  -- de rechazo en la UI). Las gestiones de pantalla fija como INS nunca
  -- tienen botón de rechazo, así que nunca deben ser recreadas aquí.
  SELECT af.code INTO v_features_code
  FROM action_features af
  WHERE af.id = NEW.action_features_id
  LIMIT 1;
  IF v_features_code = 'INS' THEN
    RETURN NEW;
  END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;
  SELECT at.code INTO v_template_code FROM action_template at WHERE at.id = v_template_id;
  SELECT business_line_id INTO v_claim_business_line FROM claims WHERE id = v_claim_id;

  SELECT ws.id, ws.workflow_config_id INTO v_step
  FROM workflow_steps ws
  WHERE ws.action_template_id = v_template_id AND ws.is_required = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT wc.* INTO v_config
  FROM workflow_configs wc
  WHERE wc.id = v_step.workflow_config_id
    AND wc.status = 'online'
    AND (SELECT status_id FROM claims WHERE id = v_claim_id) = wc.claim_status_id
    AND (wc.business_line_id IS NULL OR wc.business_line_id = v_claim_business_line)
    AND (wc.country_id IS NULL OR wc.country_id = (SELECT country_id FROM claims WHERE id = v_claim_id))
    AND (wc.event_id IS NULL OR wc.event_id = (SELECT event_id FROM claims WHERE id = v_claim_id));

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_existing_count
  FROM claim_actions ca
  JOIN action_template at ON at.id = ca.action_template_id
  JOIN lookup_catalog lc ON lc.id = ca.action_status_id
  WHERE ca.claim_id = v_claim_id
    AND at.code = v_template_code
    AND ca.is_active = true
    AND ca.id != NEW.id
    AND lc.code != 'rejected';

  IF v_existing_count = 0 THEN
    INSERT INTO claim_actions (
      claim_id, action_template_id, action_features_id,
      line_business_id, name, action_status_id,
      action_data, screen_snapshot, screen_snapshot_at,
      is_automatic, is_active, origin, created_by, created_on
    )
    SELECT
      v_claim_id, at.id, at.action_features_id,
      at.line_business_id, at.name, v_todo_status,
      '{}'::jsonb, gs.form_schema, now(),
      true, true, 'W', COALESCE(NEW.updated_by, NEW.issued_by, NEW.created_by), now()
    FROM action_template at
    LEFT JOIN action_features af ON af.id = at.action_features_id
    LEFT JOIN gestion_screens gs ON gs.id = af.screen_id
    WHERE at.id = v_template_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_recreate_rejected_workflow_action IS
'Recreate rejected workflow actions marked as is_required. Excludes INS (pantalla fija, sin botón de rechazo). Migration 251.';
