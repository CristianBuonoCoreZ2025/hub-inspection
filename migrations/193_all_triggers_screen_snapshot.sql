-- ═══════════════════════════════════════════════════════════════
-- Migración 193: Capturar screen_snapshot en TODOS los triggers del workflow
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEMA:
-- Solo execute_workflow_on_status_change captura el screen_snapshot.
-- Las otras 3 funciones que crean claim_actions (cascade_workflow_on_issue,
-- auto_recreate_rejected_workflow_action, sync_workflow_for_claim) NO lo
-- hacen, lo que hace que las gestiones creadas por esos caminos no tengan
-- snapshot y usen el form_schema actual (que puede cambiar después).
--
-- SOLUCIÓN:
-- 1. Crear un helper get_screen_snapshot(p_features_id) que busque el
--    form_schema del gestion_screen asociado a un action_features.
-- 2. Modificar las 3 funciones para que usen el helper y guarden
--    screen_snapshot + screen_snapshot_at en el INSERT.
--
-- IMPACTO:
-- - TODAS las gestiones creadas por workflow (cambio de estado, cascade,
--   recreate, sync) ahora capturan el snapshot.
-- - Las gestiones manuales ya lo hacían (createClaimAction en TS).
-- - Las gestiones existentes no se ven afectadas.
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Helper: obtener form_schema del screen asociado a un action_features ═══
CREATE OR REPLACE FUNCTION get_screen_snapshot(p_features_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_schema JSONB;
BEGIN
  IF p_features_id IS NULL THEN RETURN NULL; END IF;
  SELECT gs.form_schema INTO v_schema
  FROM action_features af
  LEFT JOIN gestion_screens gs ON gs.id = af.screen_id
  WHERE af.id = p_features_id;
  RETURN v_schema;
END;
$$;

-- ═══ 2. cascade_workflow_on_issue: agregar screen_snapshot ═══
CREATE OR REPLACE FUNCTION cascade_workflow_on_issue()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_parent_code VARCHAR(50);
  v_claim_business_line UUID;
  v_todo_status UUID;
  v_child RECORD;
  v_child_template_id UUID;
  v_existing_count INT;
  v_snapshot JSONB;
  v_parent_action_data JSONB;
  v_child_features_id UUID;
  v_screen_schema JSONB;
BEGIN
  IF NEW.issued_on IS NULL THEN RETURN NEW; END IF;
  IF OLD.issued_on IS NOT NULL THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  SELECT code INTO v_parent_code FROM action_template WHERE id = v_template_id LIMIT 1;
  IF v_parent_code IS NULL THEN RETURN NEW; END IF;

  SELECT business_line_id INTO v_claim_business_line FROM claims WHERE id = v_claim_id LIMIT 1;
  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  v_snapshot := '[]'::jsonb;
  IF v_parent_code = 'COB' THEN
    v_snapshot := get_coverages_snapshot(NEW.id);
  ELSIF v_parent_code = 'RES' THEN
    v_snapshot := get_reserves_snapshot(NEW.id);
  END IF;

  v_parent_action_data := COALESCE(NEW.action_data, '{}'::jsonb);

  FOR v_child IN
    SELECT child_code FROM action_template_dependencies
    WHERE parent_code = v_parent_code
  LOOP
    SELECT id INTO v_child_template_id
    FROM action_template
    WHERE code = v_child.child_code
      AND is_active = true
      AND (line_business_id = v_claim_business_line OR line_business_id IS NULL)
    LIMIT 1;

    IF v_child_template_id IS NULL THEN
      SELECT id INTO v_child_template_id
      FROM action_template
      WHERE code = v_child.child_code
        AND is_active = true
      LIMIT 1;
    END IF;

    IF v_child_template_id IS NULL THEN CONTINUE; END IF;

    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim_id
      AND ca.action_template_id = v_child_template_id
      AND ca.is_active = true
      AND lc.code != 'rejected';

    IF v_existing_count = 0 THEN
      -- Obtener action_features_id y screen_snapshot del hijo
      SELECT at.action_features_id INTO v_child_features_id
      FROM action_template at WHERE at.id = v_child_template_id;
      v_screen_schema := get_screen_snapshot(v_child_features_id);

      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        action_data,
        is_automatic, is_active, origin, created_by, created_on,
        screen_snapshot, screen_snapshot_at
      )
      SELECT
        v_claim_id,
        at.id,
        at.action_features_id,
        at.line_business_id,
        at.name,
        v_todo_status,
        jsonb_build_object(
          'parent_snapshot', v_snapshot,
          'parent_action_data', v_parent_action_data,
          'parent_action_id', NEW.id,
          'parent_code', v_parent_code
        ),
        true, true, 'W',
        NEW.issued_by,
        now(),
        v_screen_schema,
        CASE WHEN v_screen_schema IS NOT NULL THEN now() ELSE NULL END
      FROM action_template at
      WHERE at.id = v_child_template_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ═══ 3. auto_recreate_rejected_workflow_action: agregar screen_snapshot ═══
CREATE OR REPLACE FUNCTION auto_recreate_rejected_workflow_action()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_todo_status UUID;
  v_is_rejected BOOLEAN;
  v_step RECORD;
  v_config RECORD;
  v_existing_count INT;
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
  v_screen_schema JSONB;
BEGIN
  IF NEW.action_status_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.action_status_id = OLD.action_status_id THEN RETURN NEW; END IF;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  SELECT (lc.code = 'rejected') INTO v_is_rejected
  FROM lookup_catalog lc WHERE lc.id = NEW.action_status_id;
  IF NOT v_is_rejected THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

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
    AND (wc.business_line_id IS NULL OR wc.business_line_id = (SELECT business_line_id FROM claims WHERE id = v_claim_id))
    AND (wc.country_id IS NULL OR wc.country_id = (SELECT country_id FROM claims WHERE id = v_claim_id))
    AND (wc.event_id IS NULL OR wc.event_id = (SELECT event_id FROM claims WHERE id = v_claim_id));

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_existing_count
  FROM claim_actions ca
  JOIN lookup_catalog lc ON lc.id = ca.action_status_id
  WHERE ca.claim_id = v_claim_id
    AND ca.action_template_id = v_template_id
    AND ca.is_active = true
    AND ca.id != NEW.id
    AND lc.code != 'rejected';

  IF v_existing_count = 0 THEN
    SELECT ar.issuer_id, ar.reviewer_id, ar.approver_id, ar.dispatcher_id
    INTO v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
    FROM assign_action_responsibles(v_claim_id, v_template_id) ar
    LIMIT 1;

    -- Capturar snapshot del screen del action_features
    v_screen_schema := get_screen_snapshot(NEW.action_features_id);

    INSERT INTO claim_actions (
      claim_id, action_template_id, action_features_id,
      line_business_id, name, action_status_id,
      is_automatic, is_active, origin, created_by, created_on,
      issuer_id, reviewer_id, approver_id, dispatcher_id,
      screen_snapshot, screen_snapshot_at
    )
    SELECT
      v_claim_id, NEW.action_template_id, NEW.action_features_id,
      NEW.line_business_id, NEW.name, v_todo_status,
      true, true, 'W', COALESCE(NEW.updated_by, NEW.issued_by, NEW.created_by), now(),
      v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id,
      v_screen_schema,
      CASE WHEN v_screen_schema IS NOT NULL THEN now() ELSE NULL END
    FROM action_template at WHERE at.id = v_template_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══ 4. sync_workflow_for_claim: agregar screen_snapshot ═══
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
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
  v_screen_schema JSONB;
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
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
        CONTINUE;
      END IF;

      -- No crear padre si el hijo ya existe en proceso
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

        IF v_child_existing_count > 0 THEN EXIT; END IF;
      END LOOP;

      IF v_child_existing_count > 0 THEN
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
        CONTINUE;
      END IF;

      -- Asignar responsables según el rol del template
      SELECT ar.issuer_id, ar.reviewer_id, ar.approver_id, ar.dispatcher_id
      INTO v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
      FROM assign_action_responsibles(p_claim_id, v_step.action_template_id) ar
      LIMIT 1;

      -- Capturar snapshot del screen del action_features del template
      SELECT get_screen_snapshot(at.action_features_id) INTO v_screen_schema
      FROM action_template at WHERE at.id = v_step.action_template_id;

      -- Crear la gestión con responsables asignados + snapshot
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on,
        issuer_id, reviewer_id, approver_id, dispatcher_id,
        screen_snapshot, screen_snapshot_at
      )
      SELECT
        p_claim_id, v_step.action_template_id, at.action_features_id,
        at.line_business_id, at.name, v_todo_status,
        true, true, 'W', NULL, now(),
        v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id,
        v_screen_schema,
        CASE WHEN v_screen_schema IS NOT NULL THEN now() ELSE NULL END
      FROM action_template at WHERE at.id = v_step.action_template_id;

      RETURN QUERY
        SELECT v_step.action_template_id, at.name, true
        FROM action_template at WHERE at.id = v_step.action_template_id;
    END LOOP;
  END LOOP;
END;
$$;
