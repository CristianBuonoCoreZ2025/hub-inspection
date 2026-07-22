-- Migración 184: Corregir action_template.code para que coincida con action_features.code
--
-- REGLA: El código compuesto que se muestra en toda la app es:
--   business_lines.code_letter + action_features.code
--   ej: "H" + "ILI" = "HILI"
--
-- Por lo tanto, action_template.code DEBE ser igual al action_features.code de su característica.
-- Antes tenía códigos inventados (IFL, NSA, COI, CPA, etc.) que no coincidían con la característica.
--
-- También se actualizan:
-- - action_template_dependencies (parent_code, child_code)
-- - claim_actions.code (reconstruido con el nuevo compuesto)
--
-- Esta migración NO borra datos. Solo actualiza códigos para cumplir la regla.
-- Verificado: no hay duplicados (feature_code + line_business_id) antes de aplicar.

-- 1. Actualizar action_template.code = action_features.code
UPDATE action_template at
SET code = af.code, updated_at = now()
FROM action_features af
WHERE at.action_features_id = af.id
  AND at.code <> af.code;

-- 2. Actualizar action_template_dependencies (parent_code y child_code)
-- Mapeo de códigos viejos → nuevos
UPDATE action_template_dependencies SET parent_code = 'CIN' WHERE parent_code = 'COI';
UPDATE action_template_dependencies SET parent_code = 'SOL' WHERE parent_code = 'NSA';
UPDATE action_template_dependencies SET child_code  = 'AJU' WHERE child_code  = 'PCA';

-- 3. Reconstruir claim_actions.code con el nuevo compuesto
-- Formato: {liquidation_number}-{line_letter}{feature_code}-{seq}
-- El seq (3 dígitos al final) se preserva.
UPDATE claim_actions ca
SET code = new_code
FROM (
  SELECT
    ca2.id,
    CONCAT(
      c.liquidation_number, '-',
      COALESCE(bl.code_letter, ''),
      af.code, '-',
      SUBSTRING(ca2.code FROM '([0-9]+)$')
    ) AS new_code
  FROM claim_actions ca2
  JOIN claims c ON c.id = ca2.claim_id
  JOIN action_template at ON at.id = ca2.action_template_id
  JOIN action_features af ON af.id = at.action_features_id
  LEFT JOIN business_lines bl ON bl.id = ca2.line_business_id
  WHERE ca2.code IS NOT NULL
) AS calc
WHERE ca.id = calc.id
  AND ca.code <> calc.new_code;

-- 4. Verificación
DO $$
DECLARE
  malos int;
BEGIN
  SELECT count(*) INTO malos
  FROM action_template at
  JOIN action_features af ON af.id = at.action_features_id
  WHERE at.code <> af.code;
  RAISE NOTICE 'action_template con code <> feature_code después de migrar: % (debe ser 0)', malos;
END $$;
