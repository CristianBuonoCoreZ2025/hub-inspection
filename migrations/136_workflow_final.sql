-- Migration 136: Workflow de Siniestros — modelo final
-- Corrige la migracion 135 con el modelo definitivo:
-- - depends_on_template_id (un solo template, no array)
-- - origin en claim_actions (M=manual, W=workflow)
-- - triggers corregidos (execute, cascade, recreate)

-- 1. Corregir workflow_steps: cambiar depends_on_step_ids por depends_on_template_id
ALTER TABLE workflow_steps DROP COLUMN IF EXISTS depends_on_step_ids;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS depends_on_template_id UUID REFERENCES action_template(id) ON DELETE SET NULL;

-- 2. Agregar origin a claim_actions
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS origin VARCHAR(1) NOT NULL DEFAULT 'M';
COMMENT ON COLUMN claim_actions.origin IS 'M=manual, W=workflow automatico';

-- 3. Funcion: ejecutar_workflow_al_cambiar_estado (corregida)
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
      AND wc.is_active = true
      AND (wc.business_line_id IS NULL OR wc.business_line_id = v_claim_business_line)
      AND (wc.country_id IS NULL OR wc.country_id = v_claim_country)
      AND (wc.event_id IS NULL OR wc.event_id = v_claim_event)
    ORDER BY wc.sort_order
  LOOP
    -- Crear gestiones nivel 1 (sin depends_on_template_id) que sean automaticas
    FOR v_step IN
      SELECT ws.* FROM workflow_steps ws
      WHERE ws.workflow_config_id = v_config.id
        AND ws.is_automatic = true
        AND ws.level = 1
        AND ws.depends_on_template_id IS NULL
      ORDER BY ws.sort_order
    LOOP
      -- No duplicar: si ya existe una gestion activa de este template, saltar
      SELECT count(*) INTO v_existing_count
      FROM claim_actions
      WHERE claim_id = NEW.id
        AND action_template_id = v_step.action_template_id
        AND is_active = true;

      IF v_existing_count = 0 THEN
        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          is_automatic, is_active, origin, created_by, created_on
        )
        SELECT
          NEW.id, v_step.action_template_id, at.action_features_id,
          at.line_business_id, at.name, v_todo_status,
          true, true, 'W', NEW.updated_by, now()
        FROM action_template at WHERE at.id = v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 4. Funcion: cascade_workflow_al_emitir
-- Al emitir una gestion (issued_on seteado), crea las gestiones dependientes
CREATE OR REPLACE FUNCTION cascade_workflow_on_issue()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_todo_status UUID;
  v_step RECORD;
  v_config RECORD;
  v_claim_status UUID;
  v_claim_business_line UUID;
  v_claim_country UUID;
  v_claim_event UUID;
  v_existing_count INT;
BEGIN
  -- Solo si issued_on paso de NULL a un valor (se emitio)
  IF NEW.issued_on IS NULL THEN RETURN NEW; END IF;
  IF OLD.issued_on IS NOT NULL THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  -- Buscar steps que dependan de este template y sean automaticos
  FOR v_step IN
    SELECT ws.* FROM workflow_steps ws
    WHERE ws.depends_on_template_id = v_template_id
      AND ws.is_automatic = true
    ORDER BY ws.level, ws.sort_order
  LOOP
    -- Verificar que el workflow config coincida con el contexto del claim
    SELECT wc.* INTO v_config
    FROM workflow_configs wc
    WHERE wc.id = v_step.workflow_config_id
      AND wc.is_active = true
      AND (SELECT status_id FROM claims WHERE id = v_claim_id) = wc.claim_status_id
      AND (wc.business_line_id IS NULL OR wc.business_line_id = (SELECT business_line_id FROM claims WHERE id = v_claim_id))
      AND (wc.country_id IS NULL OR wc.country_id = (SELECT country_id FROM claims WHERE id = v_claim_id))
      AND (wc.event_id IS NULL OR wc.event_id = (SELECT event_id FROM claims WHERE id = v_claim_id));

    IF NOT FOUND THEN CONTINUE; END IF;

    -- No duplicar
    SELECT count(*) INTO v_existing_count
    FROM claim_actions
    WHERE claim_id = v_claim_id
      AND action_template_id = v_step.action_template_id
      AND is_active = true;

    IF v_existing_count = 0 THEN
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on
      )
      SELECT
        v_claim_id, v_step.action_template_id, at.action_features_id,
        at.line_business_id, at.name, v_todo_status,
        true, true, 'W', NEW.issued_by, now()
      FROM action_template at WHERE at.id = v_step.action_template_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_workflow ON claim_actions;
CREATE TRIGGER trg_cascade_workflow AFTER UPDATE OF issued_on ON claim_actions
FOR EACH ROW EXECUTE FUNCTION cascade_workflow_on_issue();

-- 5. Funcion: auto_recrear_gestion_rechazada (corregida con origin)
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

  -- Verificar contexto del claim
  SELECT wc.* INTO v_config
  FROM workflow_configs wc
  WHERE wc.id = v_step.workflow_config_id
    AND wc.is_active = true
    AND (SELECT status_id FROM claims WHERE id = v_claim_id) = wc.claim_status_id
    AND (wc.business_line_id IS NULL OR wc.business_line_id = (SELECT business_line_id FROM claims WHERE id = v_claim_id))
    AND (wc.country_id IS NULL OR wc.country_id = (SELECT country_id FROM claims WHERE id = v_claim_id))
    AND (wc.event_id IS NULL OR wc.event_id = (SELECT event_id FROM claims WHERE id = v_claim_id));

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- No duplicar
  SELECT count(*) INTO v_existing_count
  FROM claim_actions
  WHERE claim_id = v_claim_id
    AND action_template_id = v_template_id
    AND is_active = true
    AND id != NEW.id;

  IF v_existing_count = 0 THEN
    INSERT INTO claim_actions (
      claim_id, action_template_id, action_features_id,
      line_business_id, name, action_status_id,
      is_automatic, is_active, origin, created_by, created_on
    )
    SELECT
      v_claim_id, NEW.action_template_id, NEW.action_features_id,
      NEW.line_business_id, NEW.name, v_todo_status,
      true, true, 'W', NEW.updated_by, now()
    FROM action_template at WHERE at.id = v_template_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-crear trigger de recreate (ya existe de migracion 135, lo dropeamos y recreamos)
DROP TRIGGER IF EXISTS trg_auto_recreate_rejected ON claim_actions;
CREATE TRIGGER trg_auto_recreate_rejected AFTER UPDATE OF action_status_id ON claim_actions
FOR EACH ROW EXECUTE FUNCTION auto_recreate_rejected_workflow_action();
