-- ═══════════════════════════════════════════════════════════════
-- Migration 154: Auto-crear inspection_session al insertar INS
-- ═══════════════════════════════════════════════════════════════
-- Cuando el trigger cascade_workflow_on_issue inserta un INS,
-- automáticamente crea la inspection_session con los datos
-- heredados del COI (parent_action_data).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_create_inspection_session()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_template_code TEXT;
  v_action_data JSONB;
  v_parent_data JSONB;
  v_inspection_type TEXT;
  v_scheduled_at TEXT;
  v_contact_name TEXT;
  v_inspection_location TEXT;
  v_inspector_id TEXT;
  v_existing_count INT;
  v_inspection_number TEXT;
BEGIN
  -- Solo para acciones INS
  SELECT code INTO v_template_code FROM action_template WHERE id = NEW.action_template_id LIMIT 1;
  IF v_template_code <> 'INS' THEN RETURN NEW; END IF;

  -- Verificar si ya existe una sesión para esta claim_action
  SELECT count(*) INTO v_existing_count
  FROM inspection_sessions
  WHERE claim_action_id = NEW.id;

  IF v_existing_count > 0 THEN RETURN NEW; END IF;

  -- Extraer datos del parent_action_data
  v_action_data := COALESCE(NEW.action_data, '{}'::jsonb);
  v_parent_data := COALESCE((v_action_data->'parent_action_data')::jsonb, '{}'::jsonb);

  v_inspection_type := COALESCE(
    v_action_data->>'coord_inspection_type',
    v_parent_data->>'coord_inspection_type',
    'onsite'
  );

  v_scheduled_at := COALESCE(
    v_action_data->>'coord_fecha',
    v_parent_data->>'coord_fecha'
  );

  v_contact_name := COALESCE(
    v_action_data->>'coord_contacto',
    v_parent_data->>'coord_contacto'
  );

  v_inspection_location := COALESCE(
    v_action_data->>'coord_ubicacion',
    v_parent_data->>'coord_ubicacion'
  );

  v_inspector_id := COALESCE(
    v_action_data->>'coord_inspector',
    v_parent_data->>'coord_inspector'
  );

  -- Generar número de inspección
  v_inspection_number := 'INS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((random() * 9999)::int::text, 4, '0');

  -- Crear la sesión de inspección
  INSERT INTO inspection_sessions (
    claim_id,
    claim_action_id,
    action_template_id,
    inspection_type,
    scheduled_at,
    interviewed_name,
    inspection_number,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.claim_id,
    NEW.id,
    NEW.action_template_id,
    v_inspection_type,
    CASE WHEN v_scheduled_at IS NOT NULL THEN v_scheduled_at::timestamptz ELSE NULL END,
    v_contact_name,
    v_inspection_number,
    'pending',
    now(),
    now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_inspection_session ON claim_actions;
CREATE TRIGGER trg_auto_create_inspection_session
  AFTER INSERT ON claim_actions
  FOR EACH ROW EXECUTE FUNCTION auto_create_inspection_session();
