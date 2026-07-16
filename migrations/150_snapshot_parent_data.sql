-- ═══════════════════════════════════════════════════════════════
-- 150: Snapshot de datos del padre al crear acción hija
-- Arquitectura: cada acción hija recibe una copia inmutable (snapshot)
-- de los datos del padre en action_data.parent_snapshot.
-- Las views leen del snapshot, NO re-query la DB.
-- COB → RES: snapshot de claim_coverages
-- RES → PCA: snapshot de claim_reserves + reserve_coverages
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar coverage_catalog_id a claim_coverages (para pólizas en emisión)
ALTER TABLE claim_coverages ADD COLUMN IF NOT EXISTS coverage_catalog_id uuid REFERENCES coverage_catalog(id) ON DELETE SET NULL;

-- 2. Función auxiliar: obtener snapshot de coberturas de una acción COB
CREATE OR REPLACE FUNCTION get_coverages_snapshot(p_action_id uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cc.id,
      'coverage_name', cc.coverage_name,
      'subcoverage_name', cc.subcoverage_name,
      'policy_coverage_id', cc.policy_coverage_id,
      'coverage_catalog_id', cc.coverage_catalog_id,
      'coverage_code', cc_cov.code,
      'coverage_catalog_name', cc_cov.name,
      'subcoverage_code', cc_sub.code,
      'subcoverage_catalog_name', cc_sub.name,
      'insured_amount', cc.insured_amount,
      'claimed_amount', cc.claimed_amount,
      'reserved_amount', cc.reserved_amount,
      'deductible_amount', cc.deductible_amount,
      'currency', cc.currency
    ) ORDER BY cc.created_at
  ), '[]'::jsonb)
  FROM claim_coverages cc
  LEFT JOIN coverage_catalog cc_cov ON cc_cov.id = COALESCE(cc.coverage_catalog_id, (SELECT coverage_catalog_id FROM policy_coverages WHERE id = cc.policy_coverage_id))
  LEFT JOIN subcoverage_catalog cc_sub ON cc_sub.id = COALESCE(cc.subcoverage_id, (SELECT subcoverage_catalog_id FROM policy_coverages WHERE id = cc.policy_coverage_id))
  WHERE cc.claim_action_id = p_action_id
    AND cc.is_active = true;
$$;

-- 3. Función auxiliar: obtener snapshot de reservas de una acción RES
CREATE OR REPLACE FUNCTION get_reserves_snapshot(p_action_id uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cr.id,
      'reserve_number', cr.reserve_number,
      'currency', cr.currency,
      'payment_date', cr.payment_date,
      'notes', cr.notes,
      'claimed_amount', cr.claimed_amount,
      'reserve_amount', cr.reserve_amount,
      'deductible_amount', cr.deductible_amount,
      'final_amount', cr.final_amount,
      'adjusted_amount', cr.adjusted_amount,
      'adjusted_deductible', cr.adjusted_deductible,
      'adjusted_final_amount', cr.adjusted_final_amount,
      'coverages', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'claim_coverage_id', rc.claim_coverage_id,
            'coverage_name', cc.coverage_name,
            'subcoverage_name', cc.subcoverage_name,
            'coverage_code', cc_cov.code,
            'subcoverage_code', cc_sub.code,
            'insured_amount', rc.insured_amount,
            'claimed_amount', rc.claimed_amount,
            'reserved_amount', rc.reserved_amount,
            'deductible_amount', rc.deductible_amount,
            'net_reserve', rc.net_reserve,
            'adjusted_amount', rc.adjusted_amount,
            'adjusted_deductible', rc.adjusted_deductible,
            'adjusted_net', rc.adjusted_net,
            'adjustment_notes', rc.adjustment_notes
          ) ORDER BY rc.reserved_amount DESC NULLS LAST
        )
        FROM reserve_coverages rc
        JOIN claim_coverages cc ON cc.id = rc.claim_coverage_id
        LEFT JOIN coverage_catalog cc_cov ON cc_cov.id = COALESCE(cc.coverage_catalog_id, (SELECT coverage_catalog_id FROM policy_coverages WHERE id = cc.policy_coverage_id))
        LEFT JOIN subcoverage_catalog cc_sub ON cc_sub.id = COALESCE(cc.subcoverage_id, (SELECT subcoverage_catalog_id FROM policy_coverages WHERE id = cc.policy_coverage_id))
        WHERE rc.claim_reserve_id = cr.id AND rc.is_active = true
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb)
  FROM claim_reserves cr
  WHERE cr.claim_action_id = p_action_id
    AND cr.is_active = true;
$$;

-- 4. Modificar cascade_workflow_on_issue para inyectar el snapshot
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

  -- ═══ Construir el snapshot según el tipo de acción padre ═══
  v_snapshot := '[]'::jsonb;
  IF v_parent_code = 'COB' THEN
    v_snapshot := get_coverages_snapshot(NEW.id);
  ELSIF v_parent_code = 'RES' THEN
    v_snapshot := get_reserves_snapshot(NEW.id);
  END IF;

  -- Preservar action_data existente del padre (own fields)
  v_parent_action_data := COALESCE(NEW.action_data, '{}'::jsonb);

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
        action_data,
        is_automatic, is_active, origin, created_by, created_on
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
