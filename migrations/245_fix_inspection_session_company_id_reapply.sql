-- ═════════════════════════════════════════════════════════════════
-- Migration 245: Re-aplicar company_id en auto_create_inspection_session
--
-- Problema: La función auto_create_inspection_session en la base de datos
-- quedó en una versión antigua que NO setea company_id. Cuando el workflow
-- crea una gestión INS, el trigger intenta insertar inspection_sessions con
-- company_id = NULL, violando la restricción NOT NULL:
--   "null value in column company_id of relation inspection_sessions
--    violates not-null constraint"
--
-- Solución: Re-crear la función con el company_id tomado de claims.company_id
-- y aplicarlo tanto en INSERT como en UPDATE de sesiones existentes.
--
-- No se modifican datos, solo la función trigger.
-- ═════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_auto_create_inspection_session ON claim_actions;
DROP FUNCTION IF EXISTS auto_create_inspection_session() CASCADE;

-- Helper find_coord_field (idempotente)
CREATE OR REPLACE FUNCTION find_coord_field(p_data JSONB, VARIADIC p_prefixes TEXT[])
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_key text;
  v_val text;
  v_prefix text;
BEGIN
  FOR v_key IN SELECT jsonb_object_keys(p_data)
  LOOP
    IF v_key ILIKE '%recoord%' THEN CONTINUE; END IF;
    FOREACH v_prefix IN ARRAY p_prefixes
    LOOP
      IF v_key LIKE v_prefix || '%' OR v_key = v_prefix THEN
        v_val := p_data->>v_key;
        IF v_val IS NOT NULL AND length(trim(v_val)) > 0 AND trim(v_val) <> 'null' AND trim(v_val) <> 'undefined' THEN
          RETURN trim(v_val);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION auto_create_inspection_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
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
  v_magic_link_expires TIMESTAMPTZ;
  v_reschedule_reason_id UUID;
  v_existing_session_id TEXT;
  v_company_id UUID;
BEGIN
  SELECT code INTO v_template_code FROM action_template WHERE id = NEW.action_template_id LIMIT 1;
  IF v_template_code <> 'INS' THEN RETURN NEW; END IF;

  -- company_id es obligatorio en inspection_sessions; tomarlo del claim
  v_company_id := (SELECT company_id FROM claims WHERE id = NEW.claim_id LIMIT 1);
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'El siniestro % no tiene company_id. No se puede crear inspection_session.', NEW.claim_id;
  END IF;

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

    v_magic_link_expires := CASE
      WHEN v_inspection_type = 'remote' AND v_scheduled_at IS NOT NULL
      THEN v_scheduled_at::timestamptz + interval '1 hour'
      ELSE NULL
    END;

    UPDATE inspection_sessions
    SET claim_action_id = NEW.id,
        action_template_id = NEW.action_template_id,
        inspection_type = v_inspection_type,
        scheduled_at = CASE WHEN v_scheduled_at IS NOT NULL THEN v_scheduled_at::timestamptz ELSE scheduled_at END,
        inspector_id = CASE WHEN v_inspector_id IS NOT NULL THEN v_inspector_id::uuid ELSE inspector_id END,
        company_id = COALESCE(company_id, v_company_id),
        status = 'scheduled',
        magic_link_extended = false,
        magic_link_expires_at = v_magic_link_expires,
        magic_link_token = COALESCE(magic_link_token, CASE WHEN v_inspection_type = 'remote' THEN replace(gen_random_uuid()::text, '-', '') ELSE NULL END),
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
    AND claim_action_id IS DISTINCT FROM NEW.id;

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

  v_magic_link_token := CASE WHEN v_inspection_type = 'remote' THEN replace(gen_random_uuid()::text, '-', '') ELSE NULL END;
  v_magic_link_expires := CASE
    WHEN v_inspection_type = 'remote' AND v_scheduled_at IS NOT NULL
    THEN v_scheduled_at::timestamptz + interval '1 hour'
    ELSE NULL
  END;

  INSERT INTO inspection_sessions (
    company_id, claim_id, claim_action_id, action_template_id,
    inspection_type, scheduled_at, interviewed_name,
    inspection_number, status, inspector_id,
    magic_link_token, magic_link_expires_at, magic_link_extended,
    created_at, updated_at
  ) VALUES (
    v_company_id, NEW.claim_id, NEW.id, NEW.action_template_id,
    v_inspection_type,
    CASE WHEN v_scheduled_at IS NOT NULL THEN v_scheduled_at::timestamptz ELSE NULL END,
    v_contact_name,
    v_inspection_number, 'scheduled',
    CASE WHEN v_inspector_id IS NOT NULL THEN v_inspector_id::uuid ELSE NULL END,
    v_magic_link_token,
    v_magic_link_expires,
    false,
    now(), now()
  );

  RETURN NEW;
END;
$$;

-- Recrear trigger
DROP TRIGGER IF EXISTS trg_auto_create_inspection_session ON claim_actions;
CREATE TRIGGER trg_auto_create_inspection_session
AFTER INSERT ON claim_actions
FOR EACH ROW EXECUTE FUNCTION auto_create_inspection_session();
