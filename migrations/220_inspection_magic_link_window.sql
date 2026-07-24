-- ═════════════════════════════════════════════════════════════════
-- Migration 220: ventana de vigencia del magic link
--
-- Regla:
-- - Inspecciones remotas: el magic link funciona dentro de una ventana
--   [scheduled_at - 1 hora, scheduled_at + 1 hora].
-- - Si se renueva fuera de la ventana (antes del inicio), se genera un
--   nuevo token pero el rango (ventana) no cambia.
-- - Si se renueva dentro de la ventana, se extiende por UNA VEZ hasta
--   scheduled_at + 2 horas.
-- - Fuera de ese rango extendido, el link expira y no se puede renovar.
--
-- SIN borrar datos.
-- ═════════════════════════════════════════════════════════════════

-- 1. Columna de control de extensión
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS magic_link_extended boolean NOT NULL DEFAULT false;

-- 2. Normalizar sesiones existentes: resetear extensión y re-calcular
--    magic_link_expires_at a la ventana base cuando haya scheduled_at.
UPDATE inspection_sessions
SET
  magic_link_extended = false,
  magic_link_expires_at = CASE
    WHEN inspection_type = 'remote' AND scheduled_at IS NOT NULL
    THEN scheduled_at + interval '1 hour'
    ELSE NULL
  END,
  magic_link_token = CASE
    WHEN inspection_type <> 'remote' THEN NULL
    ELSE magic_link_token
  END
WHERE magic_link_token IS NOT NULL;

-- 3. Actualizar trigger auto_create_inspection_session
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

  v_company_id := (SELECT company_id FROM claims WHERE id = NEW.claim_id LIMIT 1);

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

-- 4. Función para renovar/regenerar magic link
CREATE OR REPLACE FUNCTION renew_inspection_magic_link(p_session_id uuid)
RETURNS TABLE (token text, expires_at timestamptz, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
DECLARE
  v_session inspection_sessions%ROWTYPE;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_new_token text;
BEGIN
  -- Autorización tenant
  IF NOT EXISTS (
    SELECT 1 FROM inspection_sessions s
    WHERE s.id = p_session_id AND is_session_tenant_allowed(s.id)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_session FROM inspection_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada';
  END IF;

  IF v_session.inspection_type <> 'remote' THEN
    RAISE EXCEPTION 'Solo inspecciones remotas tienen magic link';
  END IF;

  IF v_session.scheduled_at IS NULL THEN
    RAISE EXCEPTION 'La inspección no tiene fecha/hora programada';
  END IF;

  IF v_session.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'La sesión está finalizada o cancelada';
  END IF;

  v_window_start := v_session.scheduled_at - interval '1 hour';
  v_window_end := v_session.scheduled_at + interval '1 hour';

  -- Fuera de la ventana (antes del inicio): nuevo token, mismo rango
  IF now() < v_window_start THEN
    v_new_token := replace(gen_random_uuid()::text, '-', '');
    UPDATE inspection_sessions
    SET magic_link_token = v_new_token,
        magic_link_expires_at = v_window_end,
        magic_link_extended = false,
        updated_at = now()
    WHERE id = p_session_id;
    RETURN QUERY SELECT v_new_token, v_window_end, 'new'::text;
    RETURN;
  END IF;

  -- Dentro de la ventana: extender una sola vez
  IF now() >= v_window_start AND now() <= v_window_end THEN
    IF v_session.magic_link_extended = true THEN
      RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'already-extended'::text;
      RETURN;
    END IF;
    UPDATE inspection_sessions
    SET magic_link_expires_at = v_window_end + interval '1 hour',
        magic_link_extended = true,
        updated_at = now()
    WHERE id = p_session_id;
    RETURN QUERY SELECT v_session.magic_link_token, v_window_end + interval '1 hour', 'extended'::text;
    RETURN;
  END IF;

  -- Dentro del rango extendido (ya extendido) o expirado
  IF now() <= v_session.magic_link_expires_at THEN
    RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'active'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'expired'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION renew_inspection_magic_link(uuid) TO authenticated;

INSERT INTO _migrations (filename) VALUES ('220_inspection_magic_link_window.sql')
ON CONFLICT (filename) DO NOTHING;
