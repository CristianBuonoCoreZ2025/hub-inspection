-- Migration 146: Actualizar triggers para usar status='online'
--
-- Los workflows solo crean gestiones cuando estan 'online'.
-- En draft o suspended, no crean nada.

CREATE OR REPLACE FUNCTION execute_workflow_on_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_config RECORD;
  v_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_claim_business_line UUID;
  v_claim_country UUID;
  v_claim_event UUID;
BEGIN
  IF NEW.status_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status_id = OLD.status_id THEN RETURN NEW; END IF;

  SELECT business_line_id, country_id, event_id
  INTO v_claim_business_line, v_claim_country, v_claim_event
  FROM claims WHERE id = NEW.id;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  FOR v_config IN
    SELECT wc.* FROM workflow_configs wc
    WHERE wc.claim_status_id = NEW.status_id
      AND wc.status = 'online'
      AND wc.business_line_id = v_claim_business_line
      AND wc.country_id = v_claim_country
      AND wc.event_id = v_claim_event
  LOOP
    FOR v_step IN
      SELECT ws.* FROM workflow_steps ws
      WHERE ws.workflow_config_id = v_config.id
        AND ws.is_automatic = true
        AND ws.level = 1
        AND ws.depends_on_template_id IS NULL
      ORDER BY ws.sort_order
    LOOP
      SELECT count(*) INTO v_existing_count
      FROM claim_actions
      WHERE claim_id = NEW.id
        AND action_template_id = v_step.action_template_id
        AND is_active = true;

      IF v_existing_count = 0 THEN
        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          is_automatic, is_active, origin, created_by, created_on
        )
        SELECT
          NEW.id, v_step.action_template_id, at.action_features_id,
          at.line_business_id, at.name, v_todo_status,
          true, true, 'W', NEW.updated_by, now()
        FROM action_template at WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Actualizar sync_workflow_for_claim para filtrar status='online'
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

-- Actualizar auto_create_actions_on_step_insert para filtrar status='online'
CREATE OR REPLACE FUNCTION auto_create_actions_on_step_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_config RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_claim RECORD;
BEGIN
  IF NEW.level != 1 OR NEW.is_automatic = false OR NEW.depends_on_template_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_config FROM workflow_configs WHERE id = NEW.workflow_config_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- Solo crear gestiones si el workflow esta online
  IF v_config.status != 'online' THEN RETURN NEW; END IF;

  SELECT id INTO v_todo_status
  FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  FOR v_claim IN
    SELECT id FROM claims
    WHERE status_id = v_config.claim_status_id
      AND business_line_id = v_config.business_line_id
      AND country_id = v_config.country_id
      AND event_id = v_config.event_id
      AND disabled = false
  LOOP
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
