-- Migration 134: Fix sync_inspection_claim_action — active no es issued
-- El status "active" de la inspeccion significa "en progreso", no "emitida".
-- Solo "completed" debe mapear a "issued".

CREATE OR REPLACE FUNCTION public.sync_inspection_claim_action()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_todo_status UUID;
  v_issued_status UUID;
  v_cancelled_status UUID;
BEGIN
  -- Solo sincronizar si hay claim_action_id y el status cambio
  IF NEW.claim_action_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Obtener los status IDs del lookup_catalog
  SELECT id INTO v_todo_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1;
  SELECT id INTO v_issued_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'issued' LIMIT 1;
  SELECT id INTO v_cancelled_status FROM lookup_catalog WHERE category = 'action_status' AND code = 'cancelled' LIMIT 1;

  -- Mapear status de inspeccion a status de claim_action
  IF NEW.status = 'scheduled' THEN
    UPDATE claim_actions SET action_status_id = v_todo_status WHERE id = NEW.claim_action_id;
  ELSIF NEW.status = 'active' THEN
    -- En progreso, sigue pendiente como gestion
    UPDATE claim_actions SET action_status_id = v_todo_status WHERE id = NEW.claim_action_id;
  ELSIF NEW.status = 'completed' THEN
    -- Completada = emitida
    UPDATE claim_actions 
    SET action_status_id = v_issued_status, issued_on = COALESCE(issued_on, NOW())
    WHERE id = NEW.claim_action_id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE claim_actions SET action_status_id = v_cancelled_status WHERE id = NEW.claim_action_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix la inspeccion actual que esta en active pero con status issued
UPDATE claim_actions ca
SET action_status_id = (SELECT id FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1),
    issued_on = NULL
FROM inspection_sessions s
WHERE s.claim_action_id = ca.id
  AND s.status = 'active'
  AND ca.action_status_id = (SELECT id FROM lookup_catalog WHERE category = 'action_status' AND code = 'issued' LIMIT 1);
