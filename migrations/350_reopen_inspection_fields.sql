-- ═══════════════════════════════════════════════════════════════════
-- Migración 350: Reapertura de inspecciones
-- ═══════════════════════════════════════════════════════════════════
-- Permite reabrir una inspección completada (status = 'completed') para
-- que el inspector pueda hacer cambios. La gestión (claim_action) deja
-- de estar emitida (vuelve a 'todo' y se limpia issued_on). Cuando el
-- inspector vuelve a completar la inspección, la gestión se emite
-- nuevamente (trigger sync_inspection_claim_action).

-- 1. Añadir campos de reapertura a inspection_sessions
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz;
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS reopened_by uuid;
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS reopened_reason text;

-- 2. Actualizar el trigger sync_inspection_claim_action para que,
--    al volver a 'scheduled' o 'active' desde 'completed', se limpie
--    issued_on (la gestión deja de estar emitida).
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
    -- Vuelve a pendiente: limpiar issued_on si estaba emitida
    UPDATE claim_actions
    SET action_status_id = v_todo_status, issued_on = NULL
    WHERE id = NEW.claim_action_id;
  ELSIF NEW.status = 'active' THEN
    -- En progreso, sigue pendiente como gestion. Limpiar issued_on
    -- por si la inspeccion fue reabierta desde 'completed'.
    UPDATE claim_actions
    SET action_status_id = v_todo_status, issued_on = NULL
    WHERE id = NEW.claim_action_id;
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

-- El trigger ya existe (migracion 129), no es necesario recrearlo.
-- Solo actualizamos la funcion arriba.
