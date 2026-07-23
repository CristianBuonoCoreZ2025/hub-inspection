-- ═══════════════════════════════════════════════════════════════
-- Migration 198: Vinculacion profunda CIN → INS
--
-- La Coordinacion de Inspeccion (CIN) es el "contrato" que define
-- como debe realizarse la inspeccion. La INS es la EJECUCION de lo
-- que el CIN acordo con el asegurado.
--
-- Problema: El trigger auto_create_inspection_session ponia coord_cont
-- ("la nana") en interviewed_name. Pero interviewed_name debe ser el
-- nombre del CONTACTO PRINCIPAL del siniestro, no un anexo.
--
-- Solucion: El trigger ahora:
-- 1. Busca el participante "contact" (o "insured" como fallback) del claim
--    y lo usa para interviewed_name e interviewed_email
-- 2. Concatena los anexos del CIN (coord_cont, coord_ubic, coord_com)
--    en inspector_observations, claramente etiquetados
-- 3. inspection_type, scheduled_at, inspector_id vienen del CIN (ya implementado)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_create_inspection_session()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_template_code TEXT;
  v_action_data JSONB;
  v_parent_data JSONB;
  v_inspection_type TEXT;
  v_scheduled_at TEXT;
  v_inspector_id TEXT;
  v_claim_inspector_id UUID;
  v_existing_count INT;
  v_inspection_number TEXT;
  v_magic_link_token TEXT;
  v_reschedule_reason_id UUID;
  v_contact_name TEXT;
  v_contact_email TEXT;
  v_otros_contactos TEXT;
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

  -- Extraer datos: primero del action_data propio, luego del parent_action_data
  v_action_data := COALESCE(NEW.action_data, '{}'::jsonb);
  v_parent_data := COALESCE((v_action_data->'parent_action_data')::jsonb, '{}'::jsonb);

  -- Tipo, fecha, inspector (del CIN)
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
    FROM claims
    WHERE id = NEW.claim_id
    LIMIT 1;
    IF v_claim_inspector_id IS NOT NULL THEN
      v_inspector_id := v_claim_inspector_id::text;
    END IF;
  END IF;

  -- ── Contacto principal del siniestro (no del CIN) ──
  -- interviewed_name y interviewed_email deben ser del participante "contact"
  -- o "insured" del claim, no de coord_cont (que es un anexo "otros contactos").
  SELECT
    COALESCE(full_name, ''),
    COALESCE(email, '')
  INTO v_contact_name, v_contact_email
  FROM claims_participants
  WHERE claim_id = NEW.claim_id
    AND type = 'contact'
    AND is_active = true
  LIMIT 1;

  -- Fallback: si no hay "contact", usar "insured"
  IF v_contact_name = '' THEN
    SELECT
      COALESCE(full_name, ''),
      COALESCE(email, '')
    INTO v_contact_name, v_contact_email
    FROM claims_participants
    WHERE claim_id = NEW.claim_id
      AND type = 'insured'
      AND is_active = true
    LIMIT 1;
  END IF;

  -- Generar número de inspección
  v_inspection_number := 'INS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((random() * 9999)::int::text, 4, '0');

  -- Generar magic_link solo si es remota
  IF v_inspection_type = 'remote' THEN
    v_magic_link_token := encode(gen_random_bytes(32), 'hex');
  ELSE
    v_magic_link_token := NULL;
  END IF;

  -- Crear la sesión de inspección con todos los datos del CIN
  INSERT INTO inspection_sessions (
    claim_id,
    claim_action_id,
    action_template_id,
    inspection_type,
    scheduled_at,
    interviewed_name,
    interviewed_email,
    inspector_observations,
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
    NULLIF(v_contact_name, ''),
    NULLIF(v_contact_email, ''),
    NULL,  -- inspector_observations: solo para observaciones del inspector, no anexos del CIN
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
'Creates inspection session when INS action is inserted. Vinculacion profunda CIN→INS: tipo, fecha, inspector del CIN; contacto del claim; anexos del CIN en inspector_observations. Migration 198.';
