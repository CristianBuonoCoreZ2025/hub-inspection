-- ═════════════════════════════════════════════════════════════════
-- Migration 252: Prevenir duplicados por "no resuelta" en vez de "no rechazada"
--
-- Problema: Los 3 triggers de workflow (sync_workflow_for_claim,
-- auto_recreate_rejected_workflow_action, cascade_workflow_on_issue)
-- verificaban duplicados con `lc.code != 'rejected'`, lo que cuenta
-- como "existente" cualquier gestión no rechazada, incluyendo las
-- resueltas (emitidas/revisadas/aprobadas/despachadas).
--
-- Esto impide crear una nueva INS cuando ya hay una INS emitida (resuelta),
-- aunque el usuario quiera coordinar otra inspección. Ejemplo real:
--   HCIN-002 → HINS-002 (emitida/cancelada = resuelta)
--   HCIN-004 (coordinada) → NO creó HINS-003 porque HINS-002 existe
--
-- Regla correcta:
--   - "Resuelta" = completó TODOS sus niveles de revisión requeridos
--     (emisión, revisión, aprobación, despacho según el template)
--   - Puedes tener 100 gestiones resueltas del mismo tipo (cobrables)
--   - SOLO puede haber UNA pendiente (no resuelta) por característica
--   - Excepción: característica "GEN" (genérica) puede tener varias
--     pendientes al mismo tiempo
--
-- No se modifican datos, solo lógica de triggers.
-- ═════════════════════════════════════════════════════════════════

-- ═══ 1. sync_workflow_for_claim (level 1) ═══
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

      -- No duplicar: verificar por CÓDIGO y solo contar NO RESUELTAS
      -- (no resuelta = no completó todos sus niveles de revisión)
      SELECT count(*) INTO v_existing_count
      FROM claim_actions ca
      JOIN action_template at ON at.id = ca.action_template_id
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = p_claim_id
        AND at.code = v_step_code
        AND ca.is_active = true
        AND lc.code != 'rejected'
        AND (
          ca.issued_on IS NULL
          OR (at.is_review_applicable = true AND ca.reviewed_on IS NULL)
          OR (at.is_approval_applicable = true AND ca.approved_on IS NULL)
          OR (at.is_dispatch_applicable = true AND ca.dispatched_on IS NULL)
        );

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

-- ═══ 2. auto_recreate_rejected_workflow_action ═══
-- (mantiene exclusión INS de migración 251 + nueva lógica de "no resuelta")
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

  -- Excluir gestiones con característica INS (pantalla fija, sin botón de rechazo)
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

  -- Excepción GEN: la característica genérica puede tener varias pendientes
  IF v_features_code = 'GEN' THEN
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
    RETURN NEW;
  END IF;

  -- No duplicar: contar solo NO RESUELTAS (excluyendo la propia y las rechazadas)
  SELECT count(*) INTO v_existing_count
  FROM claim_actions ca
  JOIN action_template at ON at.id = ca.action_template_id
  JOIN lookup_catalog lc ON lc.id = ca.action_status_id
  WHERE ca.claim_id = v_claim_id
    AND at.code = v_template_code
    AND ca.is_active = true
    AND ca.id != NEW.id
    AND lc.code != 'rejected'
    AND (
      ca.issued_on IS NULL
      OR (at.is_review_applicable = true AND ca.reviewed_on IS NULL)
      OR (at.is_approval_applicable = true AND ca.approved_on IS NULL)
      OR (at.is_dispatch_applicable = true AND ca.dispatched_on IS NULL)
    );

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

-- ═══ 3. cascade_workflow_on_issue ═══
-- (mantiene existing_session_id de migración 250 + nueva lógica de "no resuelta")
CREATE OR REPLACE FUNCTION cascade_workflow_on_issue()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_parent_code VARCHAR(50);
  v_child_code VARCHAR(50);
  v_claim_business_line UUID;
  v_todo_status UUID;
  v_child RECORD;
  v_child_template_id UUID;
  v_existing_count INT;
  v_snapshot JSONB;
  v_parent_action_data JSONB;
  v_child_features_id UUID;
  v_screen_schema JSONB;
  v_field_value TEXT;
  v_existing_session_id TEXT;
  v_existing_ins_action_id UUID;
  v_child_features_code TEXT;
  -- Para actualización de sesión
  v_inspection_type TEXT;
  v_scheduled_at TEXT;
  v_inspector_id TEXT;
  v_claim_inspector_id UUID;
  v_magic_link_token TEXT;
  v_magic_link_expires TIMESTAMPTZ;
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
  v_existing_session_id := v_parent_action_data->>'existing_session_id';

  FOR v_child IN
    SELECT child_code, condition_field, condition_value
    FROM action_template_dependencies
    WHERE parent_code = v_parent_code
  LOOP
    -- Verificar condición (si la dependencia es condicional)
    IF v_child.condition_field IS NOT NULL THEN
      v_field_value := LOWER(COALESCE(v_parent_action_data->>v_child.condition_field, ''));
      IF v_field_value <> LOWER(COALESCE(v_child.condition_value, '')) THEN
        CONTINUE;
      END IF;
    END IF;

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

    SELECT code INTO v_child_code FROM action_template WHERE id = v_child_template_id LIMIT 1;

    -- Si hay existing_session_id y el hijo es INS, vincular INS existente
    IF v_existing_session_id IS NOT NULL AND v_child.child_code = 'INS' THEN
      SELECT claim_action_id INTO v_existing_ins_action_id
      FROM inspection_sessions
      WHERE id = v_existing_session_id::uuid
      LIMIT 1;

      IF v_existing_ins_action_id IS NOT NULL THEN
        UPDATE claim_actions
        SET action_data = COALESCE(action_data, '{}'::jsonb) || jsonb_build_object(
              'parent_action_data', v_parent_action_data,
              'parent_action_id', NEW.id,
              'parent_code', v_parent_code
            ),
            updated_on = now()
        WHERE id = v_existing_ins_action_id;

        v_inspection_type := COALESCE(
          find_coord_field(v_parent_action_data, 'coord_type', 'coord_inspection_type'),
          'onsite'
        );
        v_scheduled_at := find_coord_field(v_parent_action_data, 'coord_fecha');
        v_inspector_id := find_coord_field(v_parent_action_data, 'coord_inspector');
        IF v_inspector_id IS NULL THEN
          SELECT inspector_id INTO v_claim_inspector_id
          FROM claims WHERE id = v_claim_id LIMIT 1;
          IF v_claim_inspector_id IS NOT NULL THEN
            v_inspector_id := v_claim_inspector_id::text;
          END IF;
        END IF;

        v_magic_link_token := CASE
          WHEN v_inspection_type = 'remote' THEN replace(gen_random_uuid()::text, '-', '')
          ELSE NULL
        END;
        v_magic_link_expires := CASE
          WHEN v_inspection_type = 'remote' AND v_scheduled_at IS NOT NULL
          THEN v_scheduled_at::timestamptz + interval '1 hour'
          ELSE NULL
        END;

        UPDATE inspection_sessions
        SET inspection_type = v_inspection_type,
            scheduled_at = CASE WHEN v_scheduled_at IS NOT NULL THEN v_scheduled_at::timestamptz ELSE scheduled_at END,
            inspector_id = CASE WHEN v_inspector_id IS NOT NULL THEN v_inspector_id::uuid ELSE inspector_id END,
            status = 'scheduled',
            magic_link_token = v_magic_link_token,
            magic_link_expires_at = v_magic_link_expires,
            magic_link_extended = false,
            updated_at = now()
        WHERE id = v_existing_session_id::uuid;
      END IF;
      CONTINUE;
    END IF;

    -- Característica del hijo (para excepción GEN)
    SELECT af.code INTO v_child_features_code
    FROM action_template at
    LEFT JOIN action_features af ON af.id = at.action_features_id
    WHERE at.id = v_child_template_id
    LIMIT 1;

    -- Excepción GEN: la característica genérica puede tener varias pendientes
    IF v_child_features_code = 'GEN' THEN
      SELECT at.action_features_id INTO v_child_features_id
      FROM action_template at WHERE at.id = v_child_template_id;
      v_screen_schema := get_screen_snapshot(v_child_features_id);

      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        action_data, screen_snapshot, screen_snapshot_at,
        is_automatic, is_active, origin, created_by, created_on
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
        v_screen_schema,
        CASE WHEN v_screen_schema IS NOT NULL THEN now() ELSE NULL END,
        true, true, 'W',
        NEW.issued_by,
        now()
      FROM action_template at
      WHERE at.id = v_child_template_id;
      CONTINUE;
    END IF;

    -- No duplicar: contar solo NO RESUELTAS
    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN action_template at ON at.id = ca.action_template_id
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim_id
      AND at.code = v_child_code
      AND ca.is_active = true
      AND lc.code != 'rejected'
      AND (
        ca.issued_on IS NULL
        OR (at.is_review_applicable = true AND ca.reviewed_on IS NULL)
        OR (at.is_approval_applicable = true AND ca.approved_on IS NULL)
        OR (at.is_dispatch_applicable = true AND ca.dispatched_on IS NULL)
      );

    IF v_existing_count = 0 THEN
      SELECT at.action_features_id INTO v_child_features_id
      FROM action_template at WHERE at.id = v_child_template_id;
      v_screen_schema := get_screen_snapshot(v_child_features_id);

      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        action_data, screen_snapshot, screen_snapshot_at,
        is_automatic, is_active, origin, created_by, created_on
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
        v_screen_schema,
        CASE WHEN v_screen_schema IS NOT NULL THEN now() ELSE NULL END,
        true, true, 'W',
        NEW.issued_by,
        now()
      FROM action_template at
      WHERE at.id = v_child_template_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_workflow_for_claim IS
'Create level-1 workflow actions for a claim. Duplicate prevention: only count NOT RESOLVED actions (not all non-rejected). GEN feature allows multiple pending. Migration 252.';

COMMENT ON FUNCTION auto_recreate_rejected_workflow_action IS
'Recreate rejected workflow actions marked as is_required. Excludes INS (pantalla fija). Duplicate prevention: only count NOT RESOLVED. GEN allows multiple pending. Migrations 251+252.';

COMMENT ON FUNCTION cascade_workflow_on_issue IS
'Create child actions when parent is issued. Supports existing_session_id (m250), screen_snapshot (m248), parent_action_data (m247). Duplicate prevention: only count NOT RESOLVED. GEN allows multiple pending. Migration 252.';
