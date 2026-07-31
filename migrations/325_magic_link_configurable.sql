-- ═════════════════════════════════════════════════════════════════
-- Migration 325: Configuración del tiempo de vigencia del magic link
--
-- Problema: El tiempo de vigencia del magic link de inspecciones
-- remotas está hardcodeado a 1 hora desde scheduled_at. Se requiere
-- que sea configurable sin hacer deploy.
--
-- Solución: Leer el valor de `system_settings` con key
-- `magic_link_window_hours`. Si no existe o es inválido, default 1h.
-- Aplica a:
--   - auto_create_inspection_session() → creación CIN
--   - renew_inspection_magic_link()    → renovación/extensión
--
-- No se modifican datos, solo el comportamiento de las funciones.
-- ═════════════════════════════════════════════════════════════════

-- Configuración por defecto: 1 hora
INSERT INTO system_settings (key, value, description)
VALUES (
  'magic_link_window_hours',
  '1',
  'Horas de vigencia del magic link desde la hora agendada de una inspección remota. Se usa en la creación CIN y en la renovación del link.'
)
ON CONFLICT (key) DO NOTHING;

-- Actualizar función de creación CIN para usar el setting
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
  v_magic_link_hours INT := 1;
  v_hours_text TEXT;
  v_reschedule_reason_id UUID;
  v_existing_session_id TEXT;
  v_company_id UUID;
BEGIN
  -- Leer horas configurables (default 1 si no existe o inválido)
  SELECT value INTO v_hours_text
  FROM system_settings
  WHERE key = 'magic_link_window_hours' AND is_active = true
  LIMIT 1;
  IF v_hours_text IS NOT NULL THEN
    BEGIN
      v_magic_link_hours := v_hours_text::int;
      IF v_magic_link_hours < 1 THEN
        v_magic_link_hours := 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_magic_link_hours := 1;
    END;
  END IF;

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
      THEN v_scheduled_at::timestamptz + (v_magic_link_hours * interval '1 hour')
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
    THEN v_scheduled_at::timestamptz + (v_magic_link_hours * interval '1 hour')
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

-- Recrear trigger (idempotente)
DROP TRIGGER IF EXISTS trg_auto_create_inspection_session ON claim_actions;
CREATE TRIGGER trg_auto_create_inspection_session
AFTER INSERT ON claim_actions
FOR EACH ROW EXECUTE FUNCTION auto_create_inspection_session();

-- Actualizar función de renovación para respetar el mismo setting
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
  v_new_expiry timestamptz;
  v_magic_link_hours INT := 1;
  v_hours_text TEXT;
BEGIN
  SELECT value INTO v_hours_text
  FROM system_settings
  WHERE key = 'magic_link_window_hours' AND is_active = true
  LIMIT 1;
  IF v_hours_text IS NOT NULL THEN
    BEGIN
      v_magic_link_hours := v_hours_text::int;
      IF v_magic_link_hours < 1 THEN
        v_magic_link_hours := 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_magic_link_hours := 1;
    END;
  END IF;

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

  v_window_start := v_session.scheduled_at - (v_magic_link_hours * interval '1 hour');
  v_window_end := v_session.scheduled_at + (v_magic_link_hours * interval '1 hour');

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

  -- Dentro del rango extendido (ya extendido) o aún vigente
  IF now() <= v_session.magic_link_expires_at THEN
    RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'active'::text;
    RETURN;
  END IF;

  -- NUEVO: Link expirado Y sesión activa -> reactivar con nuevo token por 3 horas
  IF v_session.status = 'active' THEN
    v_new_token := replace(gen_random_uuid()::text, '-', '');
    v_new_expiry := now() + interval '3 hours';
    UPDATE inspection_sessions
    SET magic_link_token = v_new_token,
        magic_link_expires_at = v_new_expiry,
        magic_link_extended = true,
        updated_at = now()
    WHERE id = p_session_id;
    RETURN QUERY SELECT v_new_token, v_new_expiry, 'reactivated'::text;
    RETURN;
  END IF;

  -- Link expirado y sesión no activa
  RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'expired'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION renew_inspection_magic_link(uuid) TO authenticated;

INSERT INTO _migrations (filename) VALUES ('325_magic_link_configurable.sql')
ON CONFLICT (filename) DO NOTHING;
