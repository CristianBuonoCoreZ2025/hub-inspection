-- ═════════════════════════════════════════════════════════════════
-- Migration 247: cascade_workflow_on_issue copia parent_action_data
--
-- Problema: La gestión INS (Inspección) se crea automáticamente al emitir
-- la gestión CIN (Coordinación de Inspección). Sin embargo, el trigger
-- cascade_workflow_on_issue creaba la acción hija SIN action_data, por lo
-- que auto_create_inspection_session no podía leer:
--   - coord_type (onsite/remote)
--   - coord_fecha (fecha programada)
--   - coord_inspector
--   - coord_cont, coord_ubic, coord_com
--
-- Resultado: la inspection_session quedaba como onsite sin fecha ni inspector,
-- aunque el CIN tuviera todos los datos correctos.
--
-- Solución: Al crear la acción hija, copiar el action_data y screen_snapshot
-- del padre en un campo anidado parent_action_data. Así auto_create_inspection_session
-- puede extraer toda la información de coordinación.
--
-- No se modifican datos existentes; solo cambia la función trigger.
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cascade_workflow_on_issue()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_claim_id UUID;
  v_template_id UUID;
  v_parent_code VARCHAR(50);
  v_child_code VARCHAR(50);
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
    -- Buscar el template hijo con el mismo codigo y la misma business_line del claim (o generico)
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

    SELECT code INTO v_child_code FROM action_template WHERE id = v_child_template_id LIMIT 1;

    -- No duplicar: verificar por CÓDIGO del template hijo
    SELECT count(*) INTO v_existing_count
    FROM claim_actions ca
    JOIN action_template at ON at.id = ca.action_template_id
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = v_claim_id
      AND at.code = v_child_code
      AND ca.is_active = true
      AND lc.code != 'rejected';

    IF v_existing_count = 0 THEN
      INSERT INTO claim_actions (
        claim_id, action_template_id, action_features_id,
        line_business_id, name, action_status_id,
        action_data, screen_snapshot,
        is_automatic, is_active, origin, created_by, created_on
      )
      SELECT
        v_claim_id,
        at.id,
        at.action_features_id,
        at.line_business_id,
        at.name,
        v_todo_status,
        jsonb_build_object('parent_action_data', COALESCE(NEW.action_data, '{}'::jsonb)),
        NEW.screen_snapshot,
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
