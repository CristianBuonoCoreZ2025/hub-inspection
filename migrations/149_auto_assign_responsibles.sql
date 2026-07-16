-- Migration 149: Auto-asignar responsable al crear gestiones del workflow
--
-- Regla: cuando el workflow crea una gestión, asigna automáticamente:
--   issuer_id    = claim.<default_issuer_role>_id    (ajustador, asistente, etc.)
--   reviewer_id  = claim.<default_reviewer_role>_id  (si tiene revisión)
--   approver_id  = claim.<default_approver_role>_id  (si tiene aprobación)
--   dispatcher_id = claim.<default_dispatcher_role>_id (si tiene despacho)
--
-- El responsable es el encargado específico de la tarea.
-- Cuando alguien resuelve la gestión, queda como issued_by/reviewed_by/approved_by.

-- ═══ Función helper: resolver el profile_id según el rol ═══
CREATE OR REPLACE FUNCTION resolve_profile_by_role(p_claim_id UUID, p_role TEXT)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF p_role IS NULL THEN RETURN NULL; END IF;

  SELECT
    CASE p_role
      WHEN 'adjuster' THEN c.adjuster_id
      WHEN 'assigned_adjuster' THEN c.assigned_adjuster_id
      WHEN 'assistant' THEN c.assistant_id
      WHEN 'inspector' THEN c.inspector_id
      WHEN 'auditor' THEN c.auditor_id
      WHEN 'dispatcher' THEN c.dispatcher_id
      ELSE NULL
    END
  INTO v_profile_id
  FROM claims c WHERE c.id = p_claim_id;

  RETURN v_profile_id;
END;
$$;

-- ═══ Función helper: asignar responsables a una gestión ═══
DROP FUNCTION IF EXISTS assign_action_responsibles(UUID, UUID);
CREATE OR REPLACE FUNCTION assign_action_responsibles(
  p_claim_id UUID,
  p_template_id UUID
) RETURNS TABLE(
  issuer_id UUID,
  reviewer_id UUID,
  approver_id UUID,
  dispatcher_id UUID
) LANGUAGE plpgsql AS $$
DECLARE
  v_template RECORD;
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
BEGIN
  SELECT default_issuer_role, default_reviewer_role, default_approver_role,
         is_review_applicable, is_approval_applicable, is_dispatch_applicable
  INTO v_template
  FROM action_template WHERE id = p_template_id;

  -- Emisor
  IF v_template.default_issuer_role IS NOT NULL THEN
    v_issuer_id := resolve_profile_by_role(p_claim_id, v_template.default_issuer_role);
  END IF;

  -- Revisor
  IF v_template.is_review_applicable = true AND v_template.default_reviewer_role IS NOT NULL THEN
    v_reviewer_id := resolve_profile_by_role(p_claim_id, v_template.default_reviewer_role);
  END IF;

  -- Aprobador
  IF v_template.is_approval_applicable = true AND v_template.default_approver_role IS NOT NULL THEN
    v_approver_id := resolve_profile_by_role(p_claim_id, v_template.default_approver_role);
  END IF;

  -- Dispatcher
  IF v_template.is_dispatch_applicable = true THEN
    v_dispatcher_id := resolve_profile_by_role(p_claim_id, 'dispatcher');
  END IF;

  RETURN QUERY SELECT v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id;
END;
$$;

-- ═══ Modificar sync_workflow_for_claim para asignar responsables ═══
CREATE OR REPLACE FUNCTION sync_workflow_for_claim(p_claim_id UUID)
RETURNS TABLE(action_template_id UUID, name TEXT, created BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_claim RECORD;
  v_config RECORD;
  v_step RECORD;
  v_child_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_child_existing_count INT;
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
BEGIN
  SELECT status_id, business_line_id, country_id, event_id
  INTO v_claim
  FROM claims WHERE id = p_claim_id;

  IF v_claim.status_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_todo_status
  FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  FOR v_config IN
    SELECT wc.* FROM workflow_configs wc
    WHERE wc.claim_status_id = v_claim.status_id
      AND wc.status = 'online'
      AND wc.business_line_id = v_claim.business_line_id
      AND wc.country_id = v_claim.country_id
      AND wc.event_id = v_claim.event_id
  LOOP
    FOR v_step IN
      SELECT ws.* FROM workflow_steps ws
      WHERE ws.workflow_config_id = v_config.id
        AND ws.is_automatic = true
        AND ws.level = 1
        AND ws.depends_on_template_id IS NULL
      ORDER BY ws.sort_order
    LOOP
      -- No duplicar: solo cuenta gestiones activas NO rechazadas
      SELECT count(*) INTO v_existing_count
      FROM claim_actions ca
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = p_claim_id
        AND ca.action_template_id = v_step.action_template_id
        AND ca.is_active = true
        AND lc.code != 'rejected';

      IF v_existing_count > 0 THEN
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
        CONTINUE;
      END IF;

      -- No crear padre si el hijo ya existe en proceso
      v_child_existing_count := 0;
      FOR v_child_step IN
        SELECT ws_child.* FROM workflow_steps ws_child
        WHERE ws_child.workflow_config_id = v_config.id
          AND ws_child.depends_on_template_id = v_step.action_template_id
      LOOP
        SELECT count(*) INTO v_child_existing_count
        FROM claim_actions ca
        JOIN lookup_catalog lc ON lc.id = ca.action_status_id
        WHERE ca.claim_id = p_claim_id
          AND ca.action_template_id = v_child_step.action_template_id
          AND ca.is_active = true
          AND lc.code != 'rejected';

        IF v_child_existing_count > 0 THEN EXIT; END IF;
      END LOOP;

      IF v_child_existing_count > 0 THEN
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
        CONTINUE;
      END IF;

      -- Asignar responsables según el rol del template
      SELECT ar.issuer_id, ar.reviewer_id, ar.approver_id, ar.dispatcher_id
      INTO v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
      FROM assign_action_responsibles(p_claim_id, v_step.action_template_id) ar
      LIMIT 1;

      -- Crear la gestión con responsables asignados
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on,
        issuer_id, reviewer_id, approver_id, dispatcher_id
      )
      SELECT
        p_claim_id, v_step.action_template_id, at.action_features_id,
        at.line_business_id, at.name, v_todo_status,
        true, true, 'W', NULL, now(),
        v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
      FROM action_template at WHERE at.id = v_step.action_template_id;

      RETURN QUERY
        SELECT v_step.action_template_id, at.name, true
        FROM action_template at WHERE at.id = v_step.action_template_id;
    END LOOP;
  END LOOP;
END;
$$;

-- ═══ Modificar cascade_workflow_on_issue para asignar responsables ═══
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
  v_child_code VARCHAR(50);
  v_existing_count INT;
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
  v_coord_inspector UUID;
  v_coord_type TEXT;
  v_coord_fecha TEXT;
  v_coord_contacto TEXT;
  v_coord_ubicacion TEXT;
  v_new_action_id UUID;
  v_magic_token UUID;
  v_magic_expires TIMESTAMPTZ;
BEGIN
  IF NEW.issued_on IS NULL THEN RETURN NEW; END IF;
  IF OLD.issued_on IS NOT NULL THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  SELECT code INTO v_parent_code FROM action_template WHERE id = v_template_id LIMIT 1;
  IF v_parent_code IS NULL THEN RETURN NEW; END IF;

  -- Si el padre es COI, extraer datos de la coordinación del action_data
  IF v_parent_code = 'COI' THEN
    v_coord_inspector := NULL;
    v_coord_type := NULL;
    v_coord_fecha := NULL;
    v_coord_contacto := NULL;
    v_coord_ubicacion := NULL;
    IF NEW.action_data IS NOT NULL THEN
      v_coord_inspector := (NEW.action_data->>'coord_inspector')::UUID;
      v_coord_type := NEW.action_data->>'coord_inspection_type';
      v_coord_fecha := NEW.action_data->>'coord_fecha';
      v_coord_contacto := NEW.action_data->>'coord_contacto';
      v_coord_ubicacion := NEW.action_data->>'coord_ubicacion';
    END IF;
    -- Si no se especificó inspector, usar el inspector_id del claim
    IF v_coord_inspector IS NULL THEN
      SELECT inspector_id INTO v_coord_inspector FROM claims WHERE id = v_claim_id LIMIT 1;
    END IF;
    -- Default a presencial si no se especificó
    IF v_coord_type IS NULL THEN v_coord_type := 'onsite'; END IF;
  END IF;

  SELECT business_line_id INTO v_claim_business_line FROM claims WHERE id = v_claim_id LIMIT 1;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  FOR v_child IN
    SELECT child_code FROM action_template_dependencies
    WHERE parent_code = v_parent_code
  LOOP
    v_child_code := v_child.child_code;

    SELECT id INTO v_child_template_id
    FROM action_template
    WHERE code = v_child_code
      AND is_active = true
      AND (line_business_id = v_claim_business_line OR line_business_id IS NULL)
    LIMIT 1;

    IF v_child_template_id IS NULL THEN
      SELECT id INTO v_child_template_id
      FROM action_template
      WHERE code = v_child_code
        AND is_active = true
      LIMIT 1;
    END IF;

    IF v_child_template_id IS NULL THEN CONTINUE; END IF;

    -- No duplicar: solo cuenta gestiones activas NO rechazadas
    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim_id
      AND ca.action_template_id = v_child_template_id
      AND ca.is_active = true
      AND lc.code != 'rejected';

    IF v_existing_count = 0 THEN
      -- Asignar responsables
      SELECT ar.issuer_id, ar.reviewer_id, ar.approver_id, ar.dispatcher_id
      INTO v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
      FROM assign_action_responsibles(v_claim_id, v_child_template_id) ar
      LIMIT 1;

      -- Si el padre es COI y el hijo es INS, sobrescribir issuer_id con el inspector de la coordinación
      IF v_parent_code = 'COI' AND v_child_code = 'INS' AND v_coord_inspector IS NOT NULL THEN
        v_issuer_id := v_coord_inspector;
      END IF;

      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on,
        issuer_id, reviewer_id, approver_id, dispatcher_id,
        action_data
      )
      SELECT
        v_claim_id, at.id, at.action_features_id,
        at.line_business_id, at.name, v_todo_status,
        true, true, 'W', COALESCE(NEW.issued_by, NEW.updated_by, NEW.created_by), now(),
        v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id,
        jsonb_build_object(
          'parent_code', v_parent_code,
          'parent_action_id', NEW.id,
          'parent_action_data', COALESCE(NEW.action_data, '{}'::jsonb)
        )
      FROM action_template at WHERE at.id = v_child_template_id
      RETURNING id INTO v_new_action_id;

      -- Si el hijo es INS y el padre es COI, crear inspection_session
      IF v_parent_code = 'COI' AND v_child_code = 'INS' AND v_new_action_id IS NOT NULL THEN
        -- Generar magic link solo si es remota
        v_magic_token := NULL;
        v_magic_expires := NULL;
        IF v_coord_type = 'remote' THEN
          v_magic_token := gen_random_uuid();
          v_magic_expires := now() + interval '24 hours';
        END IF;

        INSERT INTO inspection_sessions (
          claim_id, claim_action_id, action_template_id,
          status, inspection_type, scheduled_at,
          interviewed_name,
          magic_link_token, magic_link_expires_at,
          created_at, updated_at
        ) VALUES (
          v_claim_id, v_new_action_id, v_child_template_id,
          'scheduled', v_coord_type, COALESCE(v_coord_fecha, now()::text)::timestamptz,
          v_coord_contacto,
          v_magic_token, v_magic_expires,
          now(), now()
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ═══ Modificar auto_recreate_rejected_workflow_action para asignar responsables ═══
CREATE OR REPLACE FUNCTION auto_recreate_rejected_workflow_action()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_todo_status UUID;
  v_is_rejected BOOLEAN;
  v_step RECORD;
  v_config RECORD;
  v_existing_count INT;
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
BEGIN
  IF NEW.action_status_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.action_status_id = OLD.action_status_id THEN RETURN NEW; END IF;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  SELECT (lc.code = 'rejected') INTO v_is_rejected
  FROM lookup_catalog lc WHERE lc.id = NEW.action_status_id;
  IF NOT v_is_rejected THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  SELECT ws.id, ws.workflow_config_id INTO v_step
  FROM workflow_steps ws
  WHERE ws.action_template_id = v_template_id AND ws.is_required = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT wc.* INTO v_config
  FROM workflow_configs wc
  WHERE wc.id = v_step.workflow_config_id
    AND wc.status = 'online'
    AND (SELECT status_id FROM claims WHERE id = v_claim_id) = wc.claim_status_id
    AND (wc.business_line_id IS NULL OR wc.business_line_id = (SELECT business_line_id FROM claims WHERE id = v_claim_id))
    AND (wc.country_id IS NULL OR wc.country_id = (SELECT country_id FROM claims WHERE id = v_claim_id))
    AND (wc.event_id IS NULL OR wc.event_id = (SELECT event_id FROM claims WHERE id = v_claim_id));

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- No duplicar: solo gestiones activas NO rechazadas
  SELECT count(*) INTO v_existing_count
  FROM claim_actions ca
  JOIN lookup_catalog lc ON lc.id = ca.action_status_id
  WHERE ca.claim_id = v_claim_id
    AND ca.action_template_id = v_template_id
    AND ca.is_active = true
    AND ca.id != NEW.id
    AND lc.code != 'rejected';

  IF v_existing_count = 0 THEN
    -- Asignar responsables
    SELECT ar.issuer_id, ar.reviewer_id, ar.approver_id, ar.dispatcher_id
    INTO v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
    FROM assign_action_responsibles(v_claim_id, v_template_id) ar
    LIMIT 1;

    INSERT INTO claim_actions (
      claim_id, action_template_id, action_features_id,
      line_business_id, name, action_status_id,
      is_automatic, is_active, origin, created_by, created_on,
      issuer_id, reviewer_id, approver_id, dispatcher_id
    )
    SELECT
      v_claim_id, NEW.action_template_id, NEW.action_features_id,
      NEW.line_business_id, NEW.name, v_todo_status,
      true, true, 'W', COALESCE(NEW.updated_by, NEW.issued_by, NEW.created_by), now(),
      v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
    FROM action_template at WHERE at.id = v_template_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══ Modificar execute_workflow_on_status_change para asignar responsables ═══
CREATE OR REPLACE FUNCTION execute_workflow_on_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_config RECORD;
  v_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_claim_business_line UUID;
  v_claim_country UUID;
  v_claim_event UUID;
  v_issuer_id UUID;
  v_reviewer_id UUID;
  v_approver_id UUID;
  v_dispatcher_id UUID;
BEGIN
  IF NEW.status_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status_id = OLD.status_id THEN RETURN NEW; END IF;

  SELECT business_line_id, country_id, event_id
  INTO v_claim_business_line, v_claim_country, v_claim_event
  FROM claims WHERE id = NEW.id;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  FOR v_config IN
    SELECT wc.* FROM workflow_configs wc
    WHERE wc.claim_status_id = NEW.status_id
      AND wc.status = 'online'
      AND wc.business_line_id = v_claim_business_line
      AND wc.country_id = v_claim_country
      AND wc.event_id = v_claim_event
  LOOP
    FOR v_step IN
      SELECT ws.* FROM workflow_steps ws
      WHERE ws.workflow_config_id = v_config.id
        AND ws.is_automatic = true
        AND ws.level = 1
        AND ws.depends_on_template_id IS NULL
      ORDER BY ws.sort_order
    LOOP
      SELECT count(*) INTO v_existing_count
      FROM claim_actions ca
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = NEW.id
        AND ca.action_template_id = v_step.action_template_id
        AND ca.is_active = true
        AND lc.code != 'rejected';

      IF v_existing_count = 0 THEN
        -- Asignar responsables
        SELECT ar.issuer_id, ar.reviewer_id, ar.approver_id, ar.dispatcher_id
        INTO v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
        FROM assign_action_responsibles(NEW.id, v_step.action_template_id) ar
        LIMIT 1;

        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          is_automatic, is_active, origin, created_by, created_on,
          issuer_id, reviewer_id, approver_id, dispatcher_id
        )
        SELECT
          NEW.id, v_step.action_template_id, at.action_features_id,
          at.line_business_id, at.name, v_todo_status,
          true, true, 'W', COALESCE(NEW.updated_by, NEW.issued_by, NEW.created_by), now(),
          v_issuer_id, v_reviewer_id, v_approver_id, v_dispatcher_id
        FROM action_template at WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;
