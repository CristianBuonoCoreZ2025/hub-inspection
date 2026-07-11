-- Migration 131: Correlativo por template_code + fix codes legacy
-- El correlativo del code debe ser por template_code, no global.
-- Ej: HCOB-001, HCOB-002, HRES-001, HINS-001 (cada template tiene su propia secuencia)

-- 1. Corregir la funcion set_claim_action_code para contar por template_code
CREATE OR REPLACE FUNCTION public.set_claim_action_code()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_liquidation text;
  v_line_letter text;
  v_template_code text;
  v_max_seq int;
  v_new_seq text;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    -- Obtener liquidation_number y line_letter del claim
    SELECT c.liquidation_number, bl.code_letter
    INTO v_liquidation, v_line_letter
    FROM claims c
    LEFT JOIN business_lines bl ON bl.id = c.business_line_id
    WHERE c.id = NEW.claim_id;

    IF v_liquidation IS NULL THEN
      v_liquidation := 'UNKNOWN';
    END IF;

    IF v_line_letter IS NULL THEN
      v_line_letter := 'X';
    END IF;

    -- Obtener el código de la plantilla si existe
    IF NEW.action_template_id IS NOT NULL THEN
      SELECT t.code INTO v_template_code
      FROM action_template t
      WHERE t.id = NEW.action_template_id;
    END IF;

    IF v_template_code IS NULL THEN
      v_template_code := 'GEN';
    END IF;

    -- Calcular correlativo: count de gestiones del MISMO template_code para este claim
    SELECT count(*) INTO v_max_seq
    FROM claim_actions ca
    JOIN action_template t ON ca.action_template_id = t.id
    WHERE ca.claim_id = NEW.claim_id
      AND t.code = v_template_code;

    v_new_seq := LPAD((v_max_seq + 1)::text, 3, '0');
    -- Formato: L-000000141-HCOB-001 (liquidation + line_letter + template_code + seq)
    NEW.code := v_liquidation || '-' || v_line_letter || v_template_code || '-' || v_new_seq;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Eliminar el claim_action duplicado de inspeccion (sin sesion vinculada)
DELETE FROM claim_actions
WHERE id IN (
  SELECT ca.id
  FROM claim_actions ca
  LEFT JOIN inspection_sessions ins ON ins.claim_action_id = ca.id
  JOIN action_features af ON ca.action_features_id = af.id
  WHERE af.code = 'INS' AND ins.id IS NULL
);

-- 3. Recalcular todos los codes existentes con correlativo por template
-- Usar ROW_NUMBER() particionado por claim_id + template_code

-- Primero, limpiar los codes legacy rotos
UPDATE claim_actions SET code = NULL
WHERE code NOT LIKE 'L-%' OR code IS NULL;

-- Recalcular con una consulta que genera los nuevos codes
WITH ranked AS (
  SELECT
    ca.id,
    ca.claim_id,
    COALESCE(c.liquidation_number, 'UNKNOWN') as liquidation,
    COALESCE(bl.code_letter, 'X') as line_letter,
    COALESCE(t.code, 'GEN') as template_code,
    ROW_NUMBER() OVER (
      PARTITION BY ca.claim_id, COALESCE(t.code, 'GEN')
      ORDER BY ca.created_on
    ) as seq
  FROM claim_actions ca
  JOIN claims c ON ca.claim_id = c.id
  LEFT JOIN business_lines bl ON c.business_line_id = bl.id
  LEFT JOIN action_template t ON ca.action_template_id = t.id
)
UPDATE claim_actions
SET code = ranked.liquidation || '-' || ranked.line_letter || ranked.template_code || '-' || LPAD(ranked.seq::text, 3, '0')
FROM ranked
WHERE claim_actions.id = ranked.id;
