-- Migration 140: Trigger cascade usando action_template_dependencies
-- Reemplaza cascade_workflow_on_issue para usar la tabla de dependencias globales
-- en lugar de workflow_steps.depends_on_template_id

CREATE OR REPLACE FUNCTION cascade_workflow_on_issue()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_todo_status UUID;
  v_child RECORD;
  v_existing_count INT;
BEGIN
  -- Solo si issued_on paso de NULL a un valor (se emitio)
  IF NEW.issued_on IS NULL THEN RETURN NEW; END IF;
  IF OLD.issued_on IS NOT NULL THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  -- Buscar templates hijos directos en la tabla de dependencias globales
  FOR v_child IN
    SELECT atd.child_template_id, at.name, at.action_features_id, at.line_business_id
    FROM action_template_dependencies atd
    JOIN action_template at ON at.id = atd.child_template_id
    WHERE atd.parent_template_id = v_template_id
      AND at.is_active = true
  LOOP
    -- No duplicar: si ya existe una gestion activa de este template, saltar
    SELECT count(*) INTO v_existing_count
    FROM claim_actions
    WHERE claim_id = v_claim_id
      AND action_template_id = v_child.child_template_id
      AND is_active = true;

    IF v_existing_count = 0 THEN
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        is_automatic, is_active, origin, created_by, created_on
      )
      VALUES (
        v_claim_id,
        v_child.child_template_id,
        v_child.action_features_id,
        v_child.line_business_id,
        v_child.name,
        v_todo_status,
        true, true, 'W',
        NEW.issued_by,
        now()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
