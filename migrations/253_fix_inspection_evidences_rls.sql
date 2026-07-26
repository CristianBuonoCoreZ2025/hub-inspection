-- ═════════════════════════════════════════════════════════════════
-- Migration 253: Fix RLS policy de inspection_evidences
--
-- Problema: La policy de inspection_evidences usaba is_claim_tenant_allowed(claim_id)
-- pero las evidencias se suben con claim_id=NULL (solo session_id está seteado).
-- Esto hacía que RLS bloqueara la lectura desde el browser client, y las
-- evidencias no aparecían en el reporte (que usa session.inspection_evidences
-- vía el browser client, no el admin client).
--
-- Solución: Cambiar la policy para usar is_session_tenant_allowed(session_id),
-- igual que inspection_damages, inspection_signatures, inspection_checklists,
-- inspection_notes y damage_sketches. session_id es NOT NULL siempre.
--
-- Además, backfill de claim_id en evidencias existentes desde su session,
-- para que el campo quede consistente (aunque la policy ya no lo use).
-- ═════════════════════════════════════════════════════════════════

-- 1. Backfill claim_id desde inspection_sessions (sin sobreescribir las que ya tienen valor)
UPDATE inspection_evidences ev
SET claim_id = s.claim_id
FROM inspection_sessions s
WHERE ev.session_id = s.id
  AND ev.claim_id IS NULL;

-- 2. Drop policies viejas (que usaban claim_id)
DROP POLICY IF EXISTS inspection_evidences_tenant_select ON inspection_evidences;
DROP POLICY IF EXISTS inspection_evidences_tenant_insert ON inspection_evidences;
DROP POLICY IF EXISTS inspection_evidences_tenant_update ON inspection_evidences;
DROP POLICY IF EXISTS inspection_evidences_tenant_delete ON inspection_evidences;

-- 3. Crear policies nuevas (que usan session_id, igual que las demás tablas)
CREATE POLICY inspection_evidences_tenant_select ON inspection_evidences
  FOR SELECT TO public
  USING (is_session_tenant_allowed(session_id));

CREATE POLICY inspection_evidences_tenant_insert ON inspection_evidences
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY inspection_evidences_tenant_update ON inspection_evidences
  FOR UPDATE TO public
  USING (is_session_tenant_allowed(session_id))
  WITH CHECK (is_session_tenant_allowed(session_id));

CREATE POLICY inspection_evidences_tenant_delete ON inspection_evidences
  FOR DELETE TO public
  USING (is_session_tenant_allowed(session_id));
