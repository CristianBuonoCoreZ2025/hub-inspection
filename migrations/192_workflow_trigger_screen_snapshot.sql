-- ═══════════════════════════════════════════════════════════════
-- Migración 192: Capturar screen_snapshot en el trigger del workflow
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEMA:
-- La función execute_workflow_on_status_change() crea las claim_actions
-- automáticamente pero NO captura el screen_snapshot del form_schema
-- de la pantalla asociada al action_feature. Esto hace que las gestiones
-- creadas por el workflow no tengan snapshot y usen el form_schema
-- actual (que puede cambiar después).
--
-- SOLUCIÓN:
-- Modificar el INSERT del trigger para buscar el form_schema del
-- gestion_screen asociado al action_features del action_template,
-- y guardarlo como screen_snapshot + screen_snapshot_at.
--
-- IMPACTO:
-- - Las nuevas gestiones creadas por el workflow capturan el snapshot
--   de la pantalla al momento de creación.
-- - Las gestiones existentes no se ven afectadas.
-- ═══════════════════════════════════════════════════════════════

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
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
  v_screen_schema JSONB;
  v_features_id UUID;
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
      FROM claim_actions ca
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = NEW.id
        AND ca.action_template_id = v_step.action_template_id
        AND ca.is_active = true
        AND lc.code != 'rejected';

      IF v_existing_count = 0 THEN
        -- Asignar responsables
        SELECT ar.issuer_id, ar.reviewer_id, ar.approver_id, ar.dispatcher_id
        INTO v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
        FROM assign_action_responsibles(NEW.id, v_step.action_template_id) ar
        LIMIT 1;

        -- Obtener el action_features_id y el form_schema del screen asociado
        SELECT at.action_features_id INTO v_features_id
        FROM action_template at WHERE at.id = v_step.action_template_id;

        v_screen_schema := NULL;
        IF v_features_id IS NOT NULL THEN
          SELECT gs.form_schema INTO v_screen_schema
          FROM action_features af
          LEFT JOIN gestion_screens gs ON gs.id = af.screen_id
          WHERE af.id = v_features_id;
        END IF;

        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          is_automatic, is_active, origin, created_by, created_on,
          issuer_id, reviewer_id, approver_id, dispatcher_id,
          screen_snapshot, screen_snapshot_at
        )
        SELECT
          NEW.id, v_step.action_template_id, at.action_features_id,
          at.line_business_id, at.name, v_todo_status,
          true, true, 'W', NULL, now(),
          v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id,
          v_screen_schema, CASE WHEN v_screen_schema IS NOT NULL THEN now() ELSE NULL END
        FROM action_template at WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$function$;
