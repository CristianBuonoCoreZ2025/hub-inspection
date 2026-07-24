-- ═══════════════════════════════════════════════════════════════
-- Migration 211: auto_create_inspection_session sin pgcrypto
--
-- Problema: La función aplicada en 210 usa encode(gen_random_bytes(32), 'hex'),
-- que depende de la extensión pgcrypto. En entornos donde pgcrypto no está
-- instalada, el trigger falla con:
--   "function gen_random_bytes(integer) does not exist"
-- al insertar una nueva sesión de inspección.
--
-- Solución: Reemplazar gen_random_bytes por gen_random_uuid(), que es nativa
-- de PostgreSQL (>=13) y no requiere extensiones. Se recrea la función para
-- asegurar que el cambio se aplique.
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_auto_create_inspection_session ON claim_actions;
DROP FUNCTION IF EXISTS auto_create_inspection_session() CASCADE;

-- Helper find_coord_field (idempotente)
CREATE OR REPLACE FUNCTION find_coord_field(p_data JSONB, VARIADIC p_prefixes TEXT[])
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_key TEXT;
  v_value TEXT;
BEGIN
  IF p_data IS NULL THEN RETURN NULL; END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_data) LOOP
    IF v_key ILIKE '%recoord%' THEN CONTINUE; END IF;
    FOR i IN 1..array_length(p_prefixes, 1) LOOP
      IF starts_with(v_key, p_prefixes[i]) THEN
        v_value := p_data->>v_key;
        IF v_value IS NOT NULL AND v_value <> '' THEN
          RETURN v_value;
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

    IF v_inspection_type = 'remote' THEN
      v_magic_link_token := replace(gen_random_uuid()::text, '-', '');
    ELSE
      v_magic_link_token := NULL;
    END IF;

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

  IF v_inspection_type = 'remote' THEN
    v_magic_link_token := replace(gen_random_uuid()::text, '-', '');
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
'Creates inspection session when INS action is inserted. Uses gen_random_uuid() (no pgcrypto). Cancels prior active session. Migration 211.';

CREATE TRIGGER trg_auto_create_inspection_session
  AFTER INSERT ON claim_actions
  FOR EACH ROW EXECUTE FUNCTION auto_create_inspection_session();

INSERT INTO _migrations (filename) VALUES ('211_fix_auto_session_pgcrypto.sql')
ON CONFLICT (filename) DO NOTHING;
