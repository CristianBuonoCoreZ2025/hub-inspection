-- ═══════════════════════════════════════════════════════════════
-- Migration 195: Dependencias condicionales + CIN branching
--
-- Problema: Cuando se emite una gestión CIN (Coordinación de Inspección),
-- el trigger cascade_workflow_on_issue crea automáticamente la gestión
-- hija INS (Inspección) sin importar el resultado de la coordinación.
--
-- Regla de negocio:
--   coord_result = "coordinada" → crear INS (inspección agendada)
--   coord_result = "fallida"    → NO crear INS (se re-agenda CIN desde issueClaimAction)
--   coord_result = "desistida"  → NO crear INS (se rompe el flujo)
--
-- Solución:
-- 1. Agregar columnas `condition_field` y `condition_value` a
--    action_template_dependencies para soportar dependencias condicionales.
-- 2. Marcar la dependencia CIN → INS con condition_field='coord_result'
--    y condition_value='coordinada'.
-- 3. Modificar cascade_workflow_on_issue para que, si la dependencia tiene
--    una condición, verifique el valor del campo en action_data del padre
--    antes de crear la acción hija.
--
-- Nota: La re-coordinación de CIN cuando es "fallida" la maneja
-- issueClaimAction (servicio) creando una nueva gestión CIN manualmente.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Agregar columnas de condición a action_template_dependencies ──
ALTER TABLE action_template_dependencies
  ADD COLUMN IF NOT EXISTS condition_field VARCHAR(100);
ALTER TABLE action_template_dependencies
  ADD COLUMN IF NOT EXISTS condition_value VARCHAR(100);

COMMENT ON COLUMN action_template_dependencies.condition_field IS
  'Campo de action_data del padre que debe evaluarse para crear la acción hija. NULL = dependencia incondicional.';
COMMENT ON COLUMN action_template_dependencies.condition_value IS
  'Valor (case-insensitive) que debe tener condition_field para crear la acción hija. NULL = siempre crear.';

-- ── 2. Marcar CIN → INS como dependencia condicional ──
UPDATE action_template_dependencies
SET condition_field = 'coord_result',
    condition_value = 'coordinada',
    updated_at = now()
WHERE parent_code = 'CIN' AND child_code = 'INS';

-- ── 3. Modificar cascade_workflow_on_issue para respetar condiciones ──
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
  v_snapshot JSONB;
  v_parent_action_data JSONB;
  v_child_features_id UUID;
  v_screen_schema JSONB;
  v_field_value TEXT;
BEGIN
  IF NEW.issued_on IS NULL THEN RETURN NEW; END IF;
  IF OLD.issued_on IS NOT NULL THEN RETURN NEW; END IF;

  v_claim_id := NEW.claim_id;
  v_template_id := NEW.action_template_id;

  SELECT code INTO v_parent_code FROM action_template WHERE id = v_template_id LIMIT 1;
  IF v_parent_code IS NULL THEN RETURN NEW; END IF;

  SELECT business_line_id INTO v_claim_business_line FROM claims WHERE id = v_claim_id LIMIT 1;
  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;

  v_snapshot := '[]'::jsonb;
  IF v_parent_code = 'COB' THEN
    v_snapshot := get_coverages_snapshot(NEW.id);
  ELSIF v_parent_code = 'RES' THEN
    v_snapshot := get_reserves_snapshot(NEW.id);
  END IF;

  v_parent_action_data := COALESCE(NEW.action_data, '{}'::jsonb);

  FOR v_child IN
    SELECT child_code, condition_field, condition_value
    FROM action_template_dependencies
    WHERE parent_code = v_parent_code
  LOOP
    -- ── Verificar condición (si la dependencia es condicional) ──
    IF v_child.condition_field IS NOT NULL THEN
      v_field_value := LOWER(COALESCE(v_parent_action_data->>v_child.condition_field, ''));
      IF v_field_value <> LOWER(COALESCE(v_child.condition_value, '')) THEN
        -- La condición no se cumple: NO crear la acción hija
        CONTINUE;
      END IF;
    END IF;

    SELECT id INTO v_child_template_id
    FROM action_template
    WHERE code = v_child.child_code
      AND is_active = true
      AND (line_business_id = v_claim_business_line OR line_business_id IS NULL)
    LIMIT 1;

    IF v_child_template_id IS NULL THEN
      SELECT id INTO v_child_template_id
      FROM action_template
      WHERE code = v_child.child_code
        AND is_active = true
      LIMIT 1;
    END IF;

    IF v_child_template_id IS NULL THEN CONTINUE; END IF;

    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim_id
      AND ca.action_template_id = v_child_template_id
      AND ca.is_active = true
      AND lc.code != 'rejected';

    IF v_existing_count = 0 THEN
      -- Obtener action_features_id y screen_snapshot del hijo
      SELECT at.action_features_id INTO v_child_features_id
      FROM action_template at WHERE at.id = v_child_template_id;
      v_screen_schema := get_screen_snapshot(v_child_features_id);

      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        action_data,
        is_automatic, is_active, origin, created_by, created_on,
        screen_snapshot, screen_snapshot_at
      )
      SELECT
        v_claim_id,
        at.id,
        at.action_features_id,
        at.line_business_id,
        at.name,
        v_todo_status,
        jsonb_build_object(
          'parent_snapshot', v_snapshot,
          'parent_action_data', v_parent_action_data,
          'parent_action_id', NEW.id,
          'parent_code', v_parent_code
        ),
        true, true, 'W',
        NEW.issued_by,
        now(),
        v_screen_schema,
        CASE WHEN v_screen_schema IS NOT NULL THEN now() ELSE NULL END
      FROM action_template at
      WHERE at.id = v_child_template_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION cascade_workflow_on_issue IS
'Cascade workflow on issue. Respeto dependencias condicionales: si condition_field y condition_value están seteados, solo crea la acción hija si el campo en action_data del padre coincide (case-insensitive). Migration 195.';
