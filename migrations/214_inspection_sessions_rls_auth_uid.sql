-- ═══════════════════════════════════════════════════════════════
-- Migration 214: RLS tenant para inspection_sessions
--
-- Reemplaza las políticas abiertas por restricciones basadas en
-- auth.uid() → profiles.user_id → profiles.company_id / role.
--
-- - Usuarios internos (role = 'internal') ven todo.
-- - Usuarios con company_id solo ven filas de su compañía.
-- - SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE inspection_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_sessions_select" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_insert" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_update" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_delete" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_company_select" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_all_company" ON inspection_sessions;

CREATE POLICY "inspection_sessions_tenant_select" ON inspection_sessions
  FOR SELECT
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
    OR (SELECT p.role FROM profiles p WHERE p.user_id = auth.uid()) = 'internal'
  );

CREATE POLICY "inspection_sessions_tenant_insert" ON inspection_sessions
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
    OR (SELECT p.role FROM profiles p WHERE p.user_id = auth.uid()) = 'internal'
  );

CREATE POLICY "inspection_sessions_tenant_update" ON inspection_sessions
  FOR UPDATE
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
    OR (SELECT p.role FROM profiles p WHERE p.user_id = auth.uid()) = 'internal'
  )
  WITH CHECK (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
    OR (SELECT p.role FROM profiles p WHERE p.user_id = auth.uid()) = 'internal'
  );

CREATE POLICY "inspection_sessions_tenant_delete" ON inspection_sessions
  FOR DELETE
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
    OR (SELECT p.role FROM profiles p WHERE p.user_id = auth.uid()) = 'internal'
  );
