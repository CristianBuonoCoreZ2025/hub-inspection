-- ═══════════════════════════════════════════════════════════════
-- Migración 349: inspection_number = claim_actions.code
-- ═══════════════════════════════════════════════════════════════
-- Objetivo: Que inspection_number guarde el código de la gestión
-- (ej: L-000000642-HINS-001) en vez del código interno (INS-20260815-9540).
--
-- Esto permite consultar el código de la inspección directamente en la tabla
-- sin hacer join con claim_actions.
--
-- 1. Sobrescribir todos los inspection_number existentes con claim_actions.code
-- 2. Crear trigger AFTER INSERT para que nuevos registros se seteen automáticamente
-- ═══════════════════════════════════════════════════════════════

-- 1. Sobrescribir inspection_number con claim_actions.code
UPDATE inspection_sessions s
  SET inspection_number = ca.code
  FROM claim_actions ca
  WHERE s.claim_action_id = ca.id
    AND ca.code IS NOT NULL;

-- 2. Función que setea inspection_number desde claim_actions.code
CREATE OR REPLACE FUNCTION public.set_inspection_number_from_action()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_code text;
BEGIN
  IF NEW.claim_action_id IS NOT NULL THEN
    SELECT code INTO v_code FROM claim_actions WHERE id = NEW.claim_action_id;
    IF v_code IS NOT NULL THEN
      NEW.inspection_number := v_code;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Trigger AFTER INSERT (sobrescribe el valor que haya seteado el trigger BEFORE)
DROP TRIGGER IF EXISTS trg_set_inspection_number_from_action ON inspection_sessions;
CREATE TRIGGER trg_set_inspection_number_from_action
  BEFORE INSERT OR UPDATE OF claim_action_id ON inspection_sessions
  FOR EACH ROW EXECUTE FUNCTION set_inspection_number_from_action();

-- 4. Verificación
-- SELECT id, inspection_number, claim_action_id
-- FROM inspection_sessions
-- ORDER BY created_at DESC
-- LIMIT 10;
