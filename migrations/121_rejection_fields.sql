-- ═══════════════════════════════════════════════════════════════
-- 121: Campos de rechazo para claim_actions
--
-- Registra quién rechazó, cuándo y el comentario de cada nivel:
--   - Emisión rechazada → acción queda "rejected"
--   - Revisión rechazada → vuelve a emisión
--   - Aprobación rechazada → vuelve a revisión
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS issue_rejected_on timestamptz;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS issue_rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS issuer_rejection_comment text;

ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS review_rejected_on timestamptz;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS review_rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS approve_rejected_on timestamptz;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS approve_rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS dispatch_rejected_on timestamptz;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS dispatch_rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS dispatcher_rejection_comment text;
