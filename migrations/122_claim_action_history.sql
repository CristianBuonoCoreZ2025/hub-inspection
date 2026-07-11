-- ═══════════════════════════════════════════════════════════════
-- 122: Tabla de historial de claim_actions
--
-- Registra cada cambio de estado de una gestión:
--   - Emisión (issue), Revisión (review), Aprobación (approve)
--   - Rechazo de emisión, revisión, aprobación, despacho
--   - Reasignación de responsables
--   - Despacho
--
-- Cada registro queda inalterable (append-only).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS claim_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_action_id uuid NOT NULL REFERENCES claim_actions(id) ON DELETE CASCADE,
  -- Tipo de evento
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'issued',
    'reviewed',
    'approved',
    'dispatched',
    'rejected_issue',
    'rejected_review',
    'rejected_approve',
    'rejected_dispatch',
    'reassigned_issuer',
    'reassigned_reviewer',
    'reassigned_approver',
    'data_updated',
    'deleted'
  )),
  -- Estado anterior y nuevo
  from_status_code TEXT,
  to_status_code TEXT,
  -- Usuario que ejecutó la acción
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  -- Nivel del workflow afectado
  level TEXT CHECK (level IN ('issue', 'review', 'approve', 'dispatch', null)),
  -- Comentario (motivo de rechazo, etc.)
  comment TEXT,
  -- Responsable anterior y nuevo (para reasignaciones)
  previous_responsible uuid REFERENCES profiles(id) ON DELETE SET NULL,
  previous_responsible_name TEXT,
  new_responsible uuid REFERENCES profiles(id) ON DELETE SET NULL,
  new_responsible_name TEXT,
  -- Metadata adicional
  metadata JSONB,
  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_action_history_action
  ON claim_action_history(claim_action_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_claim_action_history_user
  ON claim_action_history(performed_by);

CREATE INDEX IF NOT EXISTS idx_claim_action_history_event
  ON claim_action_history(event_type);

-- RLS
ALTER TABLE claim_action_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "claim_action_history_select" ON claim_action_history;
CREATE POLICY "claim_action_history_select" ON claim_action_history
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "claim_action_history_insert" ON claim_action_history;
CREATE POLICY "claim_action_history_insert" ON claim_action_history
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "claim_action_history_update" ON claim_action_history;
CREATE POLICY "claim_action_history_update" ON claim_action_history
  FOR UPDATE TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "claim_action_history_delete" ON claim_action_history;
CREATE POLICY "claim_action_history_delete" ON claim_action_history
  FOR DELETE TO public USING (false);
