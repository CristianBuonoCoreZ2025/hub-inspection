-- ═══════════════════════════════════════════════════════════════
-- Migration 197: auto_create_inspection_session busca por prefijo
--
-- Problema: El trigger busca campos por ID canonico:
--   coord_inspection_type, coord_fecha, coord_inspector, coord_contacto, coord_ubicacion
-- Pero los campos del CIN tienen IDs con sufijos (coord_type_1, coord_fecha_1, etc.)
-- porque el editor de pantallas genera IDs unicos.
--
-- Solucion: Funcion helper find_coord_field que busca por prefijo en el JSONB.
-- Busca cualquier key que empiece con el prefijo dado (excluyendo coord_fecha_recoord).
-- ═══════════════════════════════════════════════════════════════

-- Funcion helper: busca el primer valor en un JSONB cuya key empiece con
-- alguno de los prefijos dados (excluyendo keys que contengan "recoord").
-- Retorna NULL si no encuentra nada.
CREATE OR REPLACE FUNCTION find_coord_field(p_data JSONB, VARIADIC p_prefixes TEXT[])
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
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

COMMENT ON FUNCTION find_coord_field IS
'Busca el primer valor no-vacio en un JSONB cuya key empiece con alguno de los prefijos. Excluye keys con "recoord". Migration 197.';

-- ── Modificar auto_create_inspection_session para usar find_coord_field ──
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

  -- Buscar por prefijo (los campos tienen IDs con sufijos como coord_type_1, coord_fecha_1, etc.)
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

  -- Inspector: primero de coord_inspector, luego fallback a claim.inspector_id
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
'Creates inspection session when INS action is inserted. Uses find_coord_field to handle field IDs with suffixes (coord_type_1, coord_fecha_1, etc.). Cancels any prior active session. Migration 197.';
