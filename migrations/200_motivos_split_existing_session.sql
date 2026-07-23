-- ═══════════════════════════════════════════════════════════════
-- Migration 200: Motivos separados (fallida/desistida) + existing_session_id
--
-- Cambios:
-- 1. Crear dos categorías distintas de motivos:
--    cancellation_reason_fallida  → para reagendamiento (CIN fallida)
--    cancellation_reason_desistida → para cancelación (CIN desistida)
-- 2. Actualizar cascade_workflow_on_issue:
--    Si action_data tiene existing_session_id → NO crear nueva INS,
--    actualizar INS existente (parent_action_id) para vincularla.
-- 3. Actualizar auto_create_inspection_session:
--    Si parent_action_data tiene existing_session_id → NO crear nueva sesión,
--    actualizar sesión existente (claim_action_id, fecha, inspector, tipo).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Insertar motivos para cancellation_reason_fallida ──
INSERT INTO lookup_catalog (category, code, name, sort_order, is_active)
VALUES
  ('cancellation_reason_fallida', 'no_answer', 'No se pudo contactar al asegurado', 1, true),
  ('cancellation_reason_fallida', 'reschedule', 'Reagendado por solicitante', 2, true),
  ('cancellation_reason_fallida', 'weather', 'Condiciones climáticas adversas', 3, true),
  ('cancellation_reason_fallida', 'access_denied', 'Acceso al inmueble denegado', 4, true),
  ('cancellation_reason_fallida', 'insured_unavailable', 'Asegurado no disponible', 5, true),
  ('cancellation_reason_fallida', 'other', 'Otro motivo', 99, true)
ON CONFLICT DO NOTHING;

-- ── 2. Insertar motivos para cancellation_reason_desistida ──
INSERT INTO lookup_catalog (category, code, name, sort_order, is_active)
VALUES
  ('cancellation_reason_desistida', 'insured_refused', 'Asegurado rechazó la inspección', 1, true),
  ('cancellation_reason_desistida', 'duplicate', 'Inspección duplicada', 2, true),
  ('cancellation_reason_desistida', 'cancelled_by_company', 'Cancelada por la compañía', 3, true),
  ('cancellation_reason_desistida', 'no_longer_needed', 'Ya no se requiere inspección', 4, true),
  ('cancellation_reason_desistida', 'other', 'Otro motivo', 99, true)
ON CONFLICT DO NOTHING;

-- ── 3. Unique indexes para las nuevas categorías ──
DROP INDEX IF EXISTS lookup_catalog_fallida_unique;
CREATE UNIQUE INDEX lookup_catalog_fallida_unique
  ON lookup_catalog (category, code)
  WHERE is_active = true AND category = 'cancellation_reason_fallida' AND code IS NOT NULL;

DROP INDEX IF EXISTS lookup_catalog_desistida_unique;
CREATE UNIQUE INDEX lookup_catalog_desistida_unique
  ON lookup_catalog (category, code)
  WHERE is_active = true AND category = 'cancellation_reason_desistida' AND code IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 4. Actualizar cascade_workflow_on_issue para respetar existing_session_id
-- ═══════════════════════════════════════════════════════════════
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
  v_field_value TEXT;
  v_existing_session_id TEXT;
  v_existing_ins_action_id UUID;
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

    -- ── Si hay existing_session_id, vincular INS existente en lugar de crear nueva ──
    IF v_existing_session_id IS NOT NULL AND v_child.child_code = 'INS' THEN
      -- Buscar la INS existente vinculada a la sesión existente
      SELECT claim_action_id INTO v_existing_ins_action_id
      FROM inspection_sessions
      WHERE id = v_existing_session_id::uuid
      LIMIT 1;

      IF v_existing_ins_action_id IS NOT NULL THEN
        -- Actualizar parent_action_data de la INS existente para vincularla al nuevo CIN
        UPDATE claim_actions
        SET action_data = COALESCE(action_data, '{}'::jsonb) || jsonb_build_object(
              'parent_action_data', v_parent_action_data,
              'parent_action_id', NEW.id,
              'parent_code', v_parent_code
            ),
            updated_on = now()
        WHERE id = v_existing_ins_action_id;
      END IF;
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim_id
      AND ca.action_template_id = v_child_template_id
      AND ca.is_active = true
      AND lc.code != 'rejected';

    IF v_existing_count = 0 THEN
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

COMMENT ON FUNCTION cascade_workflow_on_issue IS
'Cascade workflow on issue. Respeto dependencias condicionales y existing_session_id (vincula INS existente en lugar de crear nueva). Migration 200.';

-- ═══════════════════════════════════════════════════════════════
-- 5. Actualizar auto_create_inspection_session para respetar existing_session_id
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
  v_claim_inspector_id UUID;
  v_existing_count INT;
  v_inspection_number TEXT;
  v_magic_link_token TEXT;
  v_reschedule_reason_id UUID;
  v_existing_session_id TEXT;
BEGIN
  SELECT code INTO v_template_code FROM action_template WHERE id = NEW.action_template_id LIMIT 1;
  IF v_template_code <> 'INS' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_existing_count
  FROM inspection_sessions
  WHERE claim_action_id = NEW.id;

  IF v_existing_count > 0 THEN RETURN NEW; END IF;

  v_action_data := COALESCE(NEW.action_data, '{}'::jsonb);
  v_parent_data := COALESCE((v_action_data->'parent_action_data')::jsonb, '{}'::jsonb);
  v_existing_session_id := COALESCE(
    v_action_data->>'existing_session_id',
    v_parent_data->>'existing_session_id'
  );

  -- ── Si hay existing_session_id, actualizar sesión existente ──
  IF v_existing_session_id IS NOT NULL THEN
    -- Buscar por prefijo en action_data y parent_action_data
    v_inspection_type := COALESCE(
      find_coord_field(v_action_data, 'coord_type', 'coord_inspection_type'),
      find_coord_field(v_parent_data, 'coord_type', 'coord_inspection_type'),
      'onsite'
    );
    v_scheduled_at := COALESCE(
      find_coord_field(v_action_data, 'coord_fecha'),
      find_coord_field(v_parent_data, 'coord_fecha')
    );
    v_inspector_id := COALESCE(
      find_coord_field(v_action_data, 'coord_inspector'),
      find_coord_field(v_parent_data, 'coord_inspector')
    );
    IF v_inspector_id IS NULL THEN
      SELECT inspector_id INTO v_claim_inspector_id
      FROM claims WHERE id = NEW.claim_id LIMIT 1;
      IF v_claim_inspector_id IS NOT NULL THEN
        v_inspector_id := v_claim_inspector_id::text;
      END IF;
    END IF;

    -- Generar magic_link solo si es remota
    IF v_inspection_type = 'remote' THEN
      v_magic_link_token := encode(gen_random_bytes(32), 'hex');
    ELSE
      v_magic_link_token := NULL;
    END IF;

    -- Actualizar la sesión existente: vincular al nuevo CIN + nuevos datos
    UPDATE inspection_sessions
    SET claim_action_id = NEW.id,
        action_template_id = NEW.action_template_id,
        inspection_type = v_inspection_type,
        scheduled_at = CASE WHEN v_scheduled_at IS NOT NULL THEN v_scheduled_at::timestamptz ELSE scheduled_at END,
        inspector_id = CASE WHEN v_inspector_id IS NOT NULL THEN v_inspector_id::uuid ELSE inspector_id END,
        magic_link_token = CASE WHEN v_magic_link_token IS NOT NULL THEN v_magic_link_token ELSE magic_link_token END,
        magic_link_expires_at = CASE WHEN v_magic_link_token IS NOT NULL THEN now() + interval '7 days' ELSE magic_link_expires_at END,
        status = 'scheduled',
        updated_at = now()
    WHERE id = v_existing_session_id::uuid;

    RETURN NEW;
  END IF;

  -- ── Flujo normal: cancelar sesión activa previa ──
  SELECT id INTO v_reschedule_reason_id
  FROM lookup_catalog
  WHERE category = 'cancellation_reason' AND code = 'reschedule'
  LIMIT 1;

  UPDATE inspection_sessions
  SET status = 'cancelled',
      cancellation_reason_id = v_reschedule_reason_id,
      cancellation_notes = 'Reemplazada por re-coordinación (nueva gestión INS)',
      cancelled_at = now(),
      updated_at = now()
  WHERE claim_id = NEW.claim_id
    AND status IN ('scheduled', 'active')
    AND claim_action_id <> NEW.id;

  -- Extraer datos
  v_inspection_type := COALESCE(
    find_coord_field(v_action_data, 'coord_type', 'coord_inspection_type'),
    find_coord_field(v_parent_data, 'coord_type', 'coord_inspection_type'),
    'onsite'
  );
  v_scheduled_at := COALESCE(
    find_coord_field(v_action_data, 'coord_fecha'),
    find_coord_field(v_parent_data, 'coord_fecha')
  );
  v_contact_name := COALESCE(
    find_coord_field(v_action_data, 'coord_cont', 'coord_contacto'),
    find_coord_field(v_parent_data, 'coord_cont', 'coord_contacto')
  );
  v_inspection_location := COALESCE(
    find_coord_field(v_action_data, 'coord_ubic', 'coord_ubicacion'),
    find_coord_field(v_parent_data, 'coord_ubic', 'coord_ubicacion')
  );
  v_inspector_id := COALESCE(
    find_coord_field(v_action_data, 'coord_inspector'),
    find_coord_field(v_parent_data, 'coord_inspector')
  );
  IF v_inspector_id IS NULL THEN
    SELECT inspector_id INTO v_claim_inspector_id
    FROM claims WHERE id = NEW.claim_id LIMIT 1;
    IF v_claim_inspector_id IS NOT NULL THEN
      v_inspector_id := v_claim_inspector_id::text;
    END IF;
  END IF;

  v_inspection_number := 'INS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((random() * 9999)::int::text, 4, '0');

  IF v_inspection_type = 'remote' THEN
    v_magic_link_token := encode(gen_random_bytes(32), 'hex');
  ELSE
    v_magic_link_token := NULL;
  END IF;

  INSERT INTO inspection_sessions (
    claim_id, claim_action_id, action_template_id,
    inspection_type, scheduled_at, interviewed_name,
    inspection_number, status, inspector_id,
    magic_link_token, magic_link_expires_at,
    created_at, updated_at
  ) VALUES (
    NEW.claim_id, NEW.id, NEW.action_template_id,
    v_inspection_type,
    CASE WHEN v_scheduled_at IS NOT NULL THEN v_scheduled_at::timestamptz ELSE NULL END,
    v_contact_name,
    v_inspection_number, 'scheduled',
    CASE WHEN v_inspector_id IS NOT NULL THEN v_inspector_id::uuid ELSE NULL END,
    v_magic_link_token,
    CASE WHEN v_magic_link_token IS NOT NULL THEN now() + interval '7 days' ELSE NULL END,
    now(), now()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_create_inspection_session IS
'Creates inspection session when INS action is inserted. Respects existing_session_id (updates existing session instead of creating new). Migration 200.';

-- ── Verificación ──
SELECT category, code, name FROM lookup_catalog
WHERE category IN ('cancellation_reason_fallida', 'cancellation_reason_desistida')
ORDER BY category, sort_order;
