-- Migración 282: Sincronizar índices de producción en local
-- Índices que existen en producción pero no en local

-- 1. claims: índice en (created_at, disabled)
CREATE INDEX IF NOT EXISTS idx_claims_disabled_created_at
  ON public.claims (created_at, disabled);

-- 2. claims_participants: índice en claim_id
CREATE INDEX IF NOT EXISTS idx_claims_participants_claim_id
  ON public.claims_participants (claim_id);

-- 3. damage_sketches: índice en session_id
CREATE INDEX IF NOT EXISTS idx_damage_sketches_session_id
  ON public.damage_sketches (session_id);

-- 4. inspection_damages: índice en session_id
CREATE INDEX IF NOT EXISTS idx_inspection_damages_session_id
  ON public.inspection_damages (session_id);

-- 5. inspection_evidences: índice en session_id
CREATE INDEX IF NOT EXISTS idx_inspection_evidences_session_id
  ON public.inspection_evidences (session_id);

-- 6. inspection_signatures: índice en session_id
CREATE INDEX IF NOT EXISTS idx_inspection_signatures_session_id
  ON public.inspection_signatures (session_id);
