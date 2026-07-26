-- Migration 249: fix execute_workflow_on_status_change (usar NEW.updated_by, claims no tiene issued_by)

CREATE OR REPLACE FUNCTION public.execute_workflow_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_config RECORD;
  v_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_claim_business_line UUID;
  v_claim_country UUID;
  v_claim_event UUID;
  v_step_code VARCHAR(50);
  v_template_line UUID;
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
      SELECT at.code, at.line_business_id
      INTO v_step_code, v_template_line
      FROM action_template at WHERE at.id = v_step.action_template_id;

      IF v_template_line IS NOT NULL AND v_template_line != v_claim_business_line THEN
        CONTINUE;
      END IF;

      SELECT count(*) INTO v_existing_count
      FROM claim_actions ca
      JOIN action_template at ON at.id = ca.action_template_id
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = NEW.id
        AND at.code = v_step_code
        AND ca.is_active = true
        AND lc.code != 'rejected';

      IF v_existing_count = 0 THEN
        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          action_data, screen_snapshot, screen_snapshot_at,
          is_automatic, is_active, origin, created_by, created_on
        )
        SELECT
          NEW.id, at.id, at.action_features_id,
          at.line_business_id, at.name, v_todo_status,
          '{}'::jsonb, gs.form_schema, now(),
          true, true, 'W', NEW.updated_by, now()
        FROM action_template at
        LEFT JOIN action_features af ON af.id = at.action_features_id
        LEFT JOIN gestion_screens gs ON gs.id = af.screen_id
        WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$function$;
