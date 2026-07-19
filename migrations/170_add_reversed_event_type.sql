-- ═══════════════════════════════════════════════════════════════
-- Migración 170: Agregar 'reversed' al check de event_type
--
-- Permite registrar reversiones de emisión en el historial de gestiones.
-- Se usa cuando se elimina un documento que justificaba una RTA emitida.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE claim_action_history
  DROP CONSTRAINT IF EXISTS claim_action_history_event_type_check;

ALTER TABLE claim_action_history
  ADD CONSTRAINT claim_action_history_event_type_check
  CHECK (event_type IN (
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
    'deleted',
    'reversed'
  ));
