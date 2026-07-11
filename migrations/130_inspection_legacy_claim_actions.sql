-- Migration 130: Crear claim_actions para inspecciones legacy
-- Las inspecciones creadas antes de la migracion 129 no tienen claim_action.
-- Esta migracion crea claim_actions retroactivamente y vincula las sesiones.

DO $$
DECLARE
  s RECORD;
  v_todo_status UUID;
  v_issued_status UUID;
  v_cancelled_status UUID;
  v_template_id UUID;
  v_feature_id UUID := 'a1000001-0000-0000-0000-000000000001'; -- Inspeccion (INS)
  v_new_action_id UUID;
  v_inspection_name TEXT;
BEGIN
  -- Obtener status IDs
  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;
  SELECT id INTO v_issued_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'issued' LIMIT 1;
  SELECT id INTO v_cancelled_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'cancelled' LIMIT 1;

  -- Recorrer inspecciones sin claim_action_id
  FOR s IN
    SELECT ins.*, c.business_line_id, c.liquidation_number
    FROM inspection_sessions ins
    JOIN claims c ON ins.claim_id = c.id
    WHERE ins.claim_action_id IS NULL
    ORDER BY ins.created_at
  LOOP
    -- Buscar el template de inspeccion correspondiente a la linea de negocio del claim
    SELECT at.id INTO v_template_id
    FROM action_template at
    WHERE at.action_features_id = v_feature_id
      AND at.is_active = true
      AND at.line_business_id = s.business_line_id
    LIMIT 1;

    -- Si no hay template especifico de la linea, usar cualquiera activo
    IF v_template_id IS NULL THEN
      SELECT at.id INTO v_template_id
      FROM action_template at
      WHERE at.action_features_id = v_feature_id
        AND at.is_active = true
      ORDER BY at.created_at
      LIMIT 1;
    END IF;

    -- Nombre de la gestion
    v_inspection_name := CASE WHEN s.inspection_type = 'remote' THEN 'Inspección Remota' ELSE 'Inspección Presencial' END;

    -- Insertar claim_action (el trigger set_claim_action_code generara el code)
    INSERT INTO claim_actions (
      claim_id, action_features_id, action_template_id,
      name, description, action_data,
      action_status_id, is_blocker, is_automatic,
      issuer_id, expected_date
    ) VALUES (
      s.claim_id,
      v_feature_id,
      v_template_id,
      v_inspection_name,
      'Inspección ' || s.inspection_type || ' (migración retroactiva)',
      '{}'::jsonb,
      CASE
        WHEN s.status = 'scheduled' THEN v_todo_status
        WHEN s.status = 'active' THEN v_issued_status
        WHEN s.status = 'completed' THEN v_issued_status
        WHEN s.status = 'cancelled' THEN v_cancelled_status
        ELSE v_todo_status
      END,
      false,
      false,
      NULL,
      s.scheduled_at
    )
    -- Forzar que el trigger genere el code pasando NULL
    RETURNING id INTO v_new_action_id;

    -- Si la inspeccion esta active/completed, marcar issued_on
    IF s.status IN ('active', 'completed') THEN
      UPDATE claim_actions
      SET issued_on = COALESCE(s.started_at, s.ended_at, s.created_at)
      WHERE id = v_new_action_id;
    END IF;

    -- Vincular la inspeccion con el claim_action
    UPDATE inspection_sessions
    SET claim_action_id = v_new_action_id,
        action_template_id = COALESCE(s.action_template_id, v_template_id)
    WHERE id = s.id;

    RAISE NOTICE 'Inspección % vinculada con claim_action %', s.id, v_new_action_id;
  END LOOP;
END;
$$;
