-- Migration 135: Workflow de Siniestros
-- Sistema para configurar el flujo de gestiones automaticas del siniestro
-- segun pais, linea de negocio, evento y estado de liquidacion.

-- 1. Tabla: workflow_configs
-- Define un workflow para un contexto especifico (pais + linea + evento + estado)
CREATE TABLE IF NOT EXISTS workflow_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
  business_line_id UUID REFERENCES business_lines(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  claim_status_id UUID NOT NULL REFERENCES lookup_catalog(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla: workflow_steps
-- Define los pasos (gestiones) dentro de un workflow
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_config_id UUID NOT NULL REFERENCES workflow_configs(id) ON DELETE CASCADE,
  action_template_id UUID NOT NULL REFERENCES action_template(id) ON DELETE RESTRICT,
  level INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  depends_on_step_ids UUID[] NOT NULL DEFAULT '{}',
  is_automatic BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_config_id, action_template_id)
);

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_workflow_configs_status ON workflow_configs(claim_status_id);
CREATE INDEX IF NOT EXISTS idx_workflow_configs_line ON workflow_configs(business_line_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_config ON workflow_steps(workflow_config_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_template ON workflow_steps(action_template_id);

-- 4. Trigger: updated_at
CREATE OR REPLACE FUNCTION update_workflow_configs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_workflow_steps_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_workflow_configs_updated ON workflow_configs;
CREATE TRIGGER trg_workflow_configs_updated BEFORE UPDATE ON workflow_configs
FOR EACH ROW EXECUTE FUNCTION update_workflow_configs_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_steps_updated ON workflow_steps;
CREATE TRIGGER trg_workflow_steps_updated BEFORE UPDATE ON workflow_steps
FOR EACH ROW EXECUTE FUNCTION update_workflow_steps_updated_at();

-- 5. Funcion: ejecutar_workflow_al_cambiar_estado
-- Cuando un claim cambia de status, busca el workflow_config que coincida
-- y crea las gestiones automaticas (nivel 1 sin dependencias)
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

  -- Obtener datos del claim
  SELECT business_line_id, country_id, event_id
  INTO v_claim_business_line, v_claim_country, v_claim_event
  FROM claims WHERE id = NEW.id;

  -- Status "todo" para las gestiones nuevas
  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  -- Buscar workflow configs que coincidan con el nuevo estado
  FOR v_config IN
    SELECT wc.* FROM workflow_configs wc
    WHERE wc.claim_status_id = NEW.status_id
      AND wc.is_active = true
      AND (wc.business_line_id IS NULL OR wc.business_line_id = v_claim_business_line)
      AND (wc.country_id IS NULL OR wc.country_id = v_claim_country)
      AND (wc.event_id IS NULL OR wc.event_id = v_claim_event)
    ORDER BY wc.sort_order
  LOOP
    -- Crear gestiones de nivel 1 (sin dependencias) que sean automaticas
    FOR v_step IN
      SELECT ws.* FROM workflow_steps ws
      WHERE ws.workflow_config_id = v_config.id
        AND ws.is_automatic = true
        AND ws.level = 1
        AND array_length(ws.depends_on_step_ids, 1) IS NULL
      ORDER BY ws.sort_order
    LOOP
      -- Verificar que no exista ya una gestion de este template para este claim
      SELECT count(*) INTO v_existing_count
      FROM claim_actions
      WHERE claim_id = NEW.id
        AND action_template_id = v_step.action_template_id
        AND is_active = true;

      IF v_existing_count = 0 THEN
        INSERT INTO claim_actions (
          claim_id, action_template_id, action_features_id,
          line_business_id, name, action_status_id,
          is_automatic, is_active, created_by, created_on
        )
        SELECT
          NEW.id,
          v_step.action_template_id,
          at.action_features_id,
          at.line_business_id,
          at.name,
          v_todo_status,
          true,
          true,
          NEW.updated_by,
          now()
        FROM action_template at
        WHERE at.id = v_step.action_template_id;

        RAISE NOTICE 'Workflow: created action for claim % with template %', NEW.id, v_step.action_template_id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_execute_workflow ON claims;
CREATE TRIGGER trg_execute_workflow AFTER UPDATE OF status_id ON claims
FOR EACH ROW EXECUTE FUNCTION execute_workflow_on_status_change();

-- 6. Funcion: auto_recrear_gestion_rechazada
-- Si una gestion que pertenece a un workflow es rechazada desde emision
-- y es is_required, se recrea automaticamente
CREATE OR REPLACE FUNCTION auto_recreate_rejected_workflow_action()
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
  -- Solo si el status cambio a "rejected"
  IF NEW.action_status_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.action_status_id = OLD.action_status_id THEN RETURN NEW; END IF;

  -- Verificar si el nuevo status es "rejected"
  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  DECLARE v_is_rejected BOOLEAN;
  BEGIN
    SELECT (lc.code = 'rejected') INTO v_is_rejected
    FROM lookup_catalog lc WHERE lc.id = NEW.action_status_id;
    IF NOT v_is_rejected THEN RETURN NEW; END IF;
  END;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  -- Buscar si este template esta en un workflow step con is_required=true
  SELECT ws.id, ws.workflow_config_id INTO v_step
  FROM workflow_steps ws
  WHERE ws.action_template_id = v_template_id
    AND ws.is_required = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Obtener datos del claim
  SELECT status_id, business_line_id, country_id, event_id
  INTO v_claim_status, v_claim_business_line, v_claim_country, v_claim_event
  FROM claims WHERE id = v_claim_id;

  -- Verificar que el workflow config coincida con el contexto actual del claim
  SELECT wc.* INTO v_config
  FROM workflow_configs wc
  WHERE wc.id = v_step.workflow_config_id
    AND wc.is_active = true
    AND wc.claim_status_id = v_claim_status
    AND (wc.business_line_id IS NULL OR wc.business_line_id = v_claim_business_line)
    AND (wc.country_id IS NULL OR wc.country_id = v_claim_country)
    AND (wc.event_id IS NULL OR wc.event_id = v_claim_event);

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Verificar que no exista ya otra gestion activa de este template
  SELECT count(*) INTO v_existing_count
  FROM claim_actions
  WHERE claim_id = v_claim_id
    AND action_template_id = v_template_id
    AND is_active = true
    AND id != NEW.id;

  IF v_existing_count = 0 THEN
    -- Crear nueva gestion identica
    INSERT INTO claim_actions (
      claim_id, action_template_id, action_features_id,
      line_business_id, name, action_status_id,
      is_automatic, is_active, created_by, created_on
    )
    SELECT
      v_claim_id,
      NEW.action_template_id,
      NEW.action_features_id,
      NEW.line_business_id,
      NEW.name,
      v_todo_status,
      true,
      true,
      NEW.updated_by,
      now()
    FROM action_template at
    WHERE at.id = v_template_id;

    RAISE NOTICE 'Workflow: auto-recreated rejected action for claim %', v_claim_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_recreate_rejected ON claim_actions;
CREATE TRIGGER trg_auto_recreate_rejected AFTER UPDATE OF action_status_id ON claim_actions
FOR EACH ROW EXECUTE FUNCTION auto_recreate_rejected_workflow_action();
