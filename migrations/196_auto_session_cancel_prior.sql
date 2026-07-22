-- ═══════════════════════════════════════════════════════════════
-- Migration 196: auto_create_inspection_session cancela sesión previa
--
-- Problema: Cuando se re-coordina una inspección (CIN fallida → nuevo CIN
-- coordinada), el trigger cascade crea una nueva acción INS, y el trigger
-- auto_create_inspection_session intenta crear una nueva inspection_session.
-- Pero el unique constraint inspection_sessions_one_active_per_claim impide
-- tener dos sesiones activas (scheduled/active) por siniestro.
--
-- Solución: Antes de crear la nueva sesión, cancelar (status='cancelled')
-- cualquier sesión activa previa del mismo siniestro. Esto preserva el
-- historial (la sesión vieja queda cancelled, no se borra) y permite
-- crear la nueva.
--
-- Nota: La sesión vieja se cancela con cancellation_reason='reschedule'
-- (Reagendado por solicitante) y notas indicando que fue reemplazada.
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
BEGIN
  -- Solo para acciones INS
  SELECT code INTO v_template_code FROM action_template WHERE id = NEW.action_template_id LIMIT 1;
  IF v_template_code <> 'INS' THEN RETURN NEW; END IF;

  -- Verificar si ya existe una sesión para esta claim_action
  SELECT count(*) INTO v_existing_count
  FROM inspection_sessions
  WHERE claim_action_id = NEW.id;

  IF v_existing_count > 0 THEN RETURN NEW; END IF;

  -- ── Cancelar sesión activa previa del mismo siniestro ──
  -- (re-coordinación: el CIN anterior fue fallida/rechazada y se creó un nuevo CIN)
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

  -- Inspector: primero de coord_inspector, luego fallback a claim.inspector_id
  v_inspector_id := COALESCE(
    v_action_data->>'coord_inspector',
    v_parent_data->>'coord_inspector'
  );

  -- Fallback: si no hay coord_inspector, usar el inspector_id del claim
  IF v_inspector_id IS NULL THEN
    SELECT inspector_id INTO v_claim_inspector_id
    FROM claims
    WHERE id = NEW.claim_id
    LIMIT 1;

    IF v_claim_inspector_id IS NOT NULL THEN
      v_inspector_id := v_claim_inspector_id::text;
    END IF;
  END IF;

  -- Generar número de inspección
  v_inspection_number := 'INS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((random() * 9999)::int::text, 4, '0');

  -- Generar magic_link solo si es remota
  IF v_inspection_type = 'remote' THEN
    v_magic_link_token := encode(gen_random_bytes(32), 'hex');
  ELSE
    v_magic_link_token := NULL;
  END IF;

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
    inspector_id,
    magic_link_token,
    magic_link_expires_at,
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
    'scheduled',
    CASE WHEN v_inspector_id IS NOT NULL THEN v_inspector_id::uuid ELSE NULL END,
    v_magic_link_token,
    CASE WHEN v_magic_link_token IS NOT NULL THEN now() + interval '7 days' ELSE NULL END,
    now(),
    now()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_create_inspection_session IS
'Creates inspection session when INS action is inserted. Cancels any prior active session for the same claim (re-coordination). Falls back to claim.inspector_id if coord_inspector not found. Migration 196.';
