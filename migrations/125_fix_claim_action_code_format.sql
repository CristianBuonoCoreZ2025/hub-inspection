-- 125_fix_claim_action_code_format.sql
-- Corrige el formato del código de claim_actions:
-- Antes: L-000000141-H-COB-005 (con guion entre line_letter y template_code)
-- Ahora: L-000000141-HCOB-005  (sin guion entre line_letter y template_code)

-- 1. Actualizar la función set_claim_action_code()
CREATE OR REPLACE FUNCTION set_claim_action_code()
RETURNS TRIGGER AS $$
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

    -- Calcular correlativo: count de gestiones existentes para este claim
    SELECT count(*) INTO v_max_seq
    FROM claim_actions
    WHERE claim_id = NEW.claim_id;

    v_new_seq := LPAD((v_max_seq + 1)::text, 3, '0');
    -- Formato: L-000000141-HCOB-005 (sin guion entre line_letter y template_code)
    NEW.code := v_liquidation || '-' || v_line_letter || v_template_code || '-' || v_new_seq;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Arreglar códigos existentes que tienen el formato antiguo
-- Patrón antiguo: XXX-NNNNNNNNN-L-CCCC-NNN (donde L es 1 letra y CCCC es el template code)
-- Patrón nuevo:   XXX-NNNNNNNNN-LCCCC-NNN
-- Solo afecta a los que tienen el guion extra entre la letra y el template code
UPDATE claim_actions
SET code = regexp_replace(
  code,
  '^([A-Z]+-[0-9]+)-([A-Z])-([A-Z]+)-([0-9]+)$',
  '\1-\2\3-\4'
)
WHERE code ~ '^[A-Z]+-[0-9]+-[A-Z]-[A-Z]+-[0-9]+$';
