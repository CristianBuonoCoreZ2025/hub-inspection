-- ═══════════════════════════════════════════════════════════════
-- Migration 246: Arreglar códigos incompletos de claim_actions + prevenir recurrencia
--
-- PROBLEMA:
-- La migración 184 reconstruía claim_actions.code con:
--   CONCAT(liquidation, '-', line_letter, feature_code, '-', SUBSTRING(code FROM '([0-9]+)$'))
-- Si el code original NO terminaba en dígitos, SUBSTRING devolvía NULL,
-- y CONCAT trataba NULL como string vacío → quedaba "L-000000141-HSOL-" (sin seq).
--
-- Esto ya NO sigue pasando porque:
--   - El trigger set_claim_action_code (migración 131) SIEMPRE genera code completo
--     con seq cuando se inserta con code=NULL.
--   - Los INSERTs de workflow no ponen code → trigger lo genera completo.
--   - Los INSERTs de reapertura/cierre/despacho ponen codes cortos ("REA","C","DES")
--     que el trigger no toca (no son NULL ni vacíos).
--   - La migración 184 fue un UPDATE one-shot que ya se aplicó.
--
-- Esta migración:
--   1. Arregla los códigos rotos existentes (los que terminan en '-' sin seq).
--   2. Reconfirma el trigger set_claim_action_code en su versión correcta (131).
--   3. Agrega un CHECK constraint como red de seguridad: ningún code puede terminar
--      en guion ni ser una cadena vacía.
--
-- No borra datos. Solo corrige el campo code de gestiones con código incompleto.
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Reconfirmar el trigger set_claim_action_code (versión 131) ═══
-- Versión correcta: correlativo por template_code (no global).
-- Esto garantiza que toda nueva gestión con code=NULL reciba un code completo.
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

-- Re-crear el trigger por si no estuviera activo
DROP TRIGGER IF EXISTS trg_set_claim_action_code ON claim_actions;
CREATE TRIGGER trg_set_claim_action_code
  BEFORE INSERT ON claim_actions
  FOR EACH ROW
  EXECUTE FUNCTION set_claim_action_code();

-- ═══ 2. Arreglar códigos rotos existentes (terminan en '-' sin seq) ═══
-- Para cada gestión con code incompleto, calcular el seq correcto usando
-- ROW_NUMBER() particionado por claim_id + template_code, ordenado por created_on.
-- Solo se tocan los codes que terminan en '-' (los rotos). Los demás se preservan.
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
  LEFT JOIN business_lines bl ON bl.id = ca.line_business_id
  LEFT JOIN action_template t ON ca.action_template_id = t.id
  WHERE ca.code ~ '-$'  -- solo los que terminan en guion (rotos)
)
UPDATE claim_actions
SET code = ranked.liquidation || '-' || ranked.line_letter || ranked.template_code || '-' || LPAD(ranked.seq::text, 3, '0')
FROM ranked
WHERE claim_actions.id = ranked.id;

-- ═══ 3. CHECK constraint: prevenir códigos incompletos en el futuro ═══
-- Ningún code puede terminar en guion (formato incompleto) ni ser vacío.
-- Los codes NULL sí están permitidos (el trigger los rellenará).
-- Los codes cortos especiales ("REA", "C", "DES") también pasan (no terminan en '-').
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'claim_actions_code_not_incomplete'
      AND conrelid = 'claim_actions'::regclass
  ) THEN
    ALTER TABLE claim_actions
      ADD CONSTRAINT claim_actions_code_not_incomplete
      CHECK (code IS NULL OR (code <> '' AND code !~ '-$'));
  END IF;
END $$;

-- ═══ 4. Verificación ═══
DO $$
DECLARE
  rotos int;
BEGIN
  SELECT count(*) INTO rotos
  FROM claim_actions
  WHERE code ~ '-$' OR code = '';
  RAISE NOTICE 'claim_actions con code incompleto después de migrar: % (debe ser 0)', rotos;
END $$;
