-- ═════════════════════════════════════════════════════════════════
-- Migration 250: Restaurar existing_session_id en cascade_workflow_on_issue
--
-- Problema: La migración 200 agregó lógica de existing_session_id a
-- cascade_workflow_on_issue para que al emitir una CIN con existing_session_id
-- se vincule la INS existente en lugar de crear una nueva. Pero la migración
-- 248 sobreescribió la función SIN incluir esa lógica, perdiendo la capacidad
-- de reagendar inspecciones.
--
-- Además, auto_create_inspection_session es AFTER INSERT (no UPDATE), así que
-- cuando cascade_workflow_on_issue hace UPDATE de la INS existente, la sesión
-- no se actualiza. Por eso cascade_workflow_on_issue ahora también actualiza
-- la sesión directamente cuando detecta existing_session_id.
--
-- Cambios:
-- 1. cascade_workflow_on_issue: restaura lógica de existing_session_id de la
--    migración 200 + screen_snapshot de la 248 + parent_action_data de la 247.
--    Cuando detecta existing_session_id, hace UPDATE de la INS existente Y
--    actualiza la sesión con los datos del CIN (tipo, fecha, inspector, magic link).
-- 2. No se modifican datos, solo la función trigger.
-- ═════════════════════════════════════════════════════════════════

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
    -- ── Verificar condición (si la dependencia es condicional) ──
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

    -- ── Si hay existing_session_id y el hijo es INS, vincular INS existente ──
    IF v_existing_session_id IS NOT NULL AND v_child.child_code = 'INS' THEN
      -- Buscar la INS vinculada a la sesión existente
      SELECT claim_action_id INTO v_existing_ins_action_id
      FROM inspection_sessions
      WHERE id = v_existing_session_id::uuid
      LIMIT 1;

      IF v_existing_ins_action_id IS NOT NULL THEN
        -- Actualizar parent_action_data de la INS existente
        UPDATE claim_actions
        SET action_data = COALESCE(action_data, '{}'::jsonb) || jsonb_build_object(
              'parent_action_data', v_parent_action_data,
              'parent_action_id', NEW.id,
              'parent_code', v_parent_code
            ),
            updated_on = now()
        WHERE id = v_existing_ins_action_id;

        -- ── Actualizar la sesión directamente con los datos del CIN ──
        -- (auto_create_inspection_session es AFTER INSERT y no se dispara en UPDATE)
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

    -- ── Flujo normal: verificar si ya existe una INS activa ──
    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN action_template at ON at.id = ca.action_template_id
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim_id
      AND at.code = v_child_code
      AND ca.is_active = true
      AND lc.code != 'rejected';

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

COMMENT ON FUNCTION cascade_workflow_on_issue IS
'Cascade workflow on issue. Respeto dependencias condicionales, existing_session_id (vincula INS existente + actualiza sesión directamente), screen_snapshot y parent_action_data. Migration 250.';
