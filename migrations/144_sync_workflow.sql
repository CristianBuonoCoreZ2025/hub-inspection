-- Migration 144: Funcion sync_workflow_for_claim + trigger al agregar step
--
-- 1. Funcion reutilizable: sync_workflow_for_claim(claim_id)
--    Crea las gestiones faltantes del nivel 1 para el estado actual del claim.
--    Se llama desde el endpoint /api/workflows/sync-claim.
--
-- 2. Trigger: al insertar un workflow_step, crear gestiones en claims existentes
--    que coincidan con el contexto del workflow_config.

CREATE OR REPLACE FUNCTION sync_workflow_for_claim(p_claim_id UUID)
RETURNS TABLE(action_template_id UUID, name TEXT, created BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_claim RECORD;
  v_config RECORD;
  v_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
BEGIN
  -- Obtener datos del claim
  SELECT status_id, business_line_id, country_id, event_id
  INTO v_claim
  FROM claims WHERE id = p_claim_id;

  IF v_claim.status_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_todo_status
  FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  -- Buscar workflow configs que coincidan con el estado actual del claim
  FOR v_config IN
    SELECT wc.* FROM workflow_configs wc
    WHERE wc.claim_status_id = v_claim.status_id
      AND wc.is_active = true
      AND wc.business_line_id = v_claim.business_line_id
      AND wc.country_id = v_claim.country_id
      AND wc.event_id = v_claim.event_id
  LOOP
    -- Crear gestiones nivel 1 (raiz, sin dependencias) que sean automaticas
    FOR v_step IN
      SELECT ws.* FROM workflow_steps ws
      WHERE ws.workflow_config_id = v_config.id
        AND ws.is_automatic = true
        AND ws.level = 1
        AND ws.depends_on_template_id IS NULL
      ORDER BY ws.sort_order
    LOOP
      -- No duplicar
      SELECT count(*) INTO v_existing_count
      FROM claim_actions
      WHERE claim_id = p_claim_id
        AND action_template_id = v_step.action_template_id
        AND is_active = true;

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

-- 2. Trigger: al insertar un workflow_step de nivel 1, crear gestiones en claims existentes
CREATE OR REPLACE FUNCTION auto_create_actions_on_step_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_config RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_claim RECORD;
BEGIN
  -- Solo para steps de nivel 1 (raiz) que sean automaticos
  IF NEW.level != 1 OR NEW.is_automatic = false OR NEW.depends_on_template_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener el workflow config
  SELECT * INTO v_config FROM workflow_configs WHERE id = NEW.workflow_config_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_config.is_active = false THEN RETURN NEW; END IF;

  SELECT id INTO v_todo_status
  FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  -- Buscar claims que coincidan con el contexto del workflow config
  FOR v_claim IN
    SELECT id FROM claims
    WHERE status_id = v_config.claim_status_id
      AND business_line_id = v_config.business_line_id
      AND country_id = v_config.country_id
      AND event_id = v_config.event_id
      AND disabled = false
  LOOP
    -- No duplicar
    SELECT count(*) INTO v_existing_count
    FROM claim_actions
    WHERE claim_id = v_claim.id
      AND action_template_id = NEW.action_template_id
      AND is_active = true;

    IF v_existing_count = 0 THEN
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on
      )
      SELECT
        v_claim.id, NEW.action_template_id, at.action_features_id,
        at.line_business_id, at.name, v_todo_status,
        true, true, 'W', NULL, now()
      FROM action_template at WHERE at.id = NEW.action_template_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_on_step_insert ON workflow_steps;
CREATE TRIGGER trg_auto_create_on_step_insert
  AFTER INSERT ON workflow_steps
  FOR EACH ROW EXECUTE FUNCTION auto_create_actions_on_step_insert();
