-- ═══════════════════════════════════════════════════════════════
-- Migration 216: RLS tenant para todas las tablas con company_id
--
-- Crea una función de ayuda is_tenant_allowed y aplica políticas
-- SELECT/INSERT/UPDATE/DELETE a cada tabla con columna company_id.
--
-- Excepciones:
-- - _migrations (control interno)
-- - companies (catálogo raíz, no tiene company_id propio)
-- - inspection_sessions (ya migrada en 214/215)
--
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_tenant_allowed(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = auth.uid()
      AND (company_id = p_company_id OR role = 'internal')
  );
$$;

DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tab
      ON tab.table_schema = c.table_schema
     AND tab.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND tab.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('_migrations', 'inspection_sessions', 'companies')
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t.table_name);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t.table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (is_tenant_allowed(company_id));',
      t.table_name || '_tenant_select', t.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (is_tenant_allowed(company_id));',
      t.table_name || '_tenant_insert', t.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (is_tenant_allowed(company_id)) WITH CHECK (is_tenant_allowed(company_id));',
      t.table_name || '_tenant_update', t.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (is_tenant_allowed(company_id));',
      t.table_name || '_tenant_delete', t.table_name
    );
  END LOOP;
END $$;
