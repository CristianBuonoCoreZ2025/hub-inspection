-- Migration 129: Link inspection_sessions to claim_actions
-- Las inspecciones deben crear un claim_action para seguir el estandar de gestiones

-- 1. Agregar claim_action_id a inspection_sessions
ALTER TABLE inspection_sessions 
  ADD COLUMN IF NOT EXISTS claim_action_id UUID REFERENCES claim_actions(id) ON DELETE SET NULL;

-- 2. Crear indice para busqueda rapida
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_claim_action_id 
  ON inspection_sessions(claim_action_id) WHERE claim_action_id IS NOT NULL;

-- 3. Trigger: cuando una inspeccion cambia de status, sincronizar el claim_action
CREATE OR REPLACE FUNCTION sync_inspection_claim_action()
RETURNS TRIGGER AS $$
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
    UPDATE claim_actions 
    SET action_status_id = v_issued_status, issued_on = NOW(), issued_by = NEW.cancelled_by
    WHERE id = NEW.claim_action_id;
  ELSIF NEW.status = 'completed' THEN
    UPDATE claim_actions 
    SET action_status_id = v_issued_status, issued_on = COALESCE(issued_on, NOW())
    WHERE id = NEW.claim_action_id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE claim_actions SET action_status_id = v_cancelled_status WHERE id = NEW.claim_action_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inspection_claim_action ON inspection_sessions;
CREATE TRIGGER trg_sync_inspection_claim_action
  AFTER UPDATE OF status ON inspection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION sync_inspection_claim_action();
