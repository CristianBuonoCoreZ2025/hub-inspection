-- Migration 147: Fix triggers del workflow
--
-- Problemas encontrados:
-- 1. sync_workflow_for_claim: "column reference action_template_id is ambiguous"
--    porque v_step (RECORD) tiene un campo action_template_id y la tabla claim_actions
--    también. Hay que calificar la columna de la tabla.
-- 2. auto_recreate_rejected_workflow_action: sigue verificando is_active=true
--    en lugar de status='online' (no fue actualizado en migration 146).
-- 3. cascade_workflow_on_issue: mismo problema de ambigüedad con v_child_template_id.

-- ═══ 1. sync_workflow_for_claim (corregida) ═══
CREATE OR REPLACE FUNCTION sync_workflow_for_claim(p_claim_id UUID)
RETURNS TABLE(action_template_id UUID, name TEXT, created BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_claim RECORD;
  v_config RECORD;
  v_step RECORD;
  v_todo_status UUID;
  v_existing_count INT;
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

      IF v_existing_count = 0 THEN
        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          is_automatic, is_active, origin, created_by, created_on
        )
        SELECT
          p_claim_id, v_step.action_template_id, at.action_features_id,
          at.line_business_id, at.name, v_todo_status,
          true, true, 'W', NULL, now()
        FROM action_template at WHERE at.id = v_step.action_template_id;

        RETURN QUERY
          SELECT v_step.action_template_id, at.name, true
          FROM action_template at WHERE at.id = v_step.action_template_id;
      ELSE
        RETURN QUERY
          SELECT v_step.action_template_id, at.name, false
          FROM action_template at WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ═══ 2. auto_recreate_rejected_workflow_action (corregida: status='online') ═══
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
BEGIN
  IF NEW.action_status_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.action_status_id = OLD.action_status_id THEN RETURN NEW; END IF;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  SELECT (lc.code = 'rejected') INTO v_is_rejected
  FROM lookup_catalog lc WHERE lc.id = NEW.action_status_id;
  IF NOT v_is_rejected THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  -- Buscar si este template esta en un workflow step con is_required=true
  SELECT ws.id, ws.workflow_config_id INTO v_step
  FROM workflow_steps ws
  WHERE ws.action_template_id = v_template_id AND ws.is_required = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Verificar contexto del claim Y status='online' (no solo is_active)
  SELECT wc.* INTO v_config
  FROM workflow_configs wc
  WHERE wc.id = v_step.workflow_config_id
    AND wc.status = 'online'
    AND (SELECT status_id FROM claims WHERE id = v_claim_id) = wc.claim_status_id
    AND (wc.business_line_id IS NULL OR wc.business_line_id = (SELECT business_line_id FROM claims WHERE id = v_claim_id))
    AND (wc.country_id IS NULL OR wc.country_id = (SELECT country_id FROM claims WHERE id = v_claim_id))
    AND (wc.event_id IS NULL OR wc.event_id = (SELECT event_id FROM claims WHERE id = v_claim_id));

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- No duplicar: solo cuenta gestiones activas NO rechazadas
  -- (si todas las demás están rechazadas, debe recrear)
  SELECT count(*) INTO v_existing_count
  FROM claim_actions ca
  JOIN lookup_catalog lc ON lc.id = ca.action_status_id
  WHERE ca.claim_id = v_claim_id
    AND ca.action_template_id = v_template_id
    AND ca.is_active = true
    AND ca.id != NEW.id
    AND lc.code != 'rejected';

  IF v_existing_count = 0 THEN
    INSERT INTO claim_actions (
      claim_id, action_template_id, action_features_id,
      line_business_id, name, action_status_id,
      is_automatic, is_active, origin, created_by, created_on
    )
    SELECT
      v_claim_id, NEW.action_template_id, NEW.action_features_id,
      NEW.line_business_id, NEW.name, v_todo_status,
      true, true, 'W', COALESCE(NEW.updated_by, NEW.issued_by, NEW.created_by), now()
    FROM action_template at WHERE at.id = v_template_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_recreate_rejected ON claim_actions;
CREATE TRIGGER trg_auto_recreate_rejected AFTER UPDATE OF action_status_id ON claim_actions
FOR EACH ROW EXECUTE FUNCTION auto_recreate_rejected_workflow_action();

-- ═══ 3. cascade_workflow_on_issue (corregida: ambigüedad) ═══
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
BEGIN
  -- Solo si issued_on paso de NULL a un valor (se emitio)
  IF NEW.issued_on IS NULL THEN RETURN NEW; END IF;
  IF OLD.issued_on IS NOT NULL THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  -- Obtener el codigo del template padre
  SELECT code INTO v_parent_code FROM action_template WHERE id = v_template_id LIMIT 1;
  IF v_parent_code IS NULL THEN RETURN NEW; END IF;

  -- Obtener la business_line del claim
  SELECT business_line_id INTO v_claim_business_line FROM claims WHERE id = v_claim_id LIMIT 1;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  -- Buscar codigos hijos en la tabla de dependencias globales
  FOR v_child IN
    SELECT child_code FROM action_template_dependencies
    WHERE parent_code = v_parent_code
  LOOP
    -- Buscar el template hijo con el mismo codigo y la misma business_line del claim
    SELECT id INTO v_child_template_id
    FROM action_template
    WHERE code = v_child.child_code
      AND is_active = true
      AND (line_business_id = v_claim_business_line OR line_business_id IS NULL)
    LIMIT 1;

    -- Si no se encontro por business_line, buscar cualquiera con ese codigo
    IF v_child_template_id IS NULL THEN
      SELECT id INTO v_child_template_id
      FROM action_template
      WHERE code = v_child.child_code
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
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on
      )
      SELECT
        v_claim_id,
        at.id,
        at.action_features_id,
        at.line_business_id,
        at.name,
        v_todo_status,
        true, true, 'W',
        NEW.issued_by,
        now()
      FROM action_template at
      WHERE at.id = v_child_template_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_workflow ON claim_actions;
CREATE TRIGGER trg_cascade_workflow AFTER UPDATE OF issued_on ON claim_actions
FOR EACH ROW EXECUTE FUNCTION cascade_workflow_on_issue();

-- ═══ 4. execute_workflow_on_status_change (corregida: ambigüedad) ═══
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
      -- No duplicar: solo cuenta gestiones activas NO rechazadas
      SELECT count(*) INTO v_existing_count
      FROM claim_actions ca
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = NEW.id
        AND ca.action_template_id = v_step.action_template_id
        AND ca.is_active = true
        AND lc.code != 'rejected';

      IF v_existing_count = 0 THEN
        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          is_automatic, is_active, origin, created_by, created_on
        )
        SELECT
          NEW.id, v_step.action_template_id, at.action_features_id,
          at.line_business_id, at.name, v_todo_status,
          true, true, 'W', COALESCE(NEW.updated_by, NEW.issued_by, NEW.created_by), now()
        FROM action_template at WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ═══ 5. auto_create_actions_on_step_insert (corregida: ambigüedad) ═══
CREATE OR REPLACE FUNCTION auto_create_actions_on_step_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_config RECORD;
  v_todo_status UUID;
  v_existing_count INT;
  v_claim RECORD;
BEGIN
  IF NEW.level != 1 OR NEW.is_automatic = false OR NEW.depends_on_template_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_config FROM workflow_configs WHERE id = NEW.workflow_config_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- Solo crear gestiones si el workflow esta online
  IF v_config.status != 'online' THEN RETURN NEW; END IF;

  SELECT id INTO v_todo_status
  FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  FOR v_claim IN
    SELECT id FROM claims
    WHERE status_id = v_config.claim_status_id
      AND business_line_id = v_config.business_line_id
      AND country_id = v_config.country_id
      AND event_id = v_config.event_id
      AND disabled = false
  LOOP
    -- No duplicar: solo cuenta gestiones activas NO rechazadas
    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim.id
      AND ca.action_template_id = NEW.action_template_id
      AND ca.is_active = true
      AND lc.code != 'rejected';

    IF v_existing_count = 0 THEN
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on
      )
      SELECT
        v_claim.id, NEW.action_template_id, at.action_features_id,
        at.line_business_id, at.name, v_todo_status,
        true, true, 'W', NULL, now()
      FROM action_template at WHERE at.id = NEW.action_template_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
