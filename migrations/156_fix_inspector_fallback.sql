-- ═══════════════════════════════════════════════════════════════
-- Migration 156: Fix inspector_id fallback en auto_create_inspection_session
--
-- Problema: El trigger auto_create_inspection_session solo busca
-- coord_inspector en action_data/parent_action_data, pero NO hace
-- fallback a claim.inspector_id cuando no se encuentra.
-- Esto causa que el inspector asignado se pierda si el COI no tenía
-- coord_inspector en su action_data.
--
-- Solución: Agregar fallback a claims.inspector_id
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

-- Backfill: Actualizar sesiones existentes que no tienen inspector_id
-- pero cuyo claim sí lo tiene
UPDATE inspection_sessions s
SET inspector_id = c.inspector_id,
    updated_at = now()
FROM claims c
WHERE s.claim_id = c.id
  AND s.inspector_id IS NULL
  AND c.inspector_id IS NOT NULL;

COMMENT ON FUNCTION auto_create_inspection_session IS
'Creates inspection session when INS action is inserted. Falls back to claim.inspector_id if coord_inspector not found in action_data/parent_action_data. Migration 156.';
