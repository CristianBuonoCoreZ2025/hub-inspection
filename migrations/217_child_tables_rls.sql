-- ═══════════════════════════════════════════════════════════════
-- Migration 217: RLS tenant para tablas hijas (sin company_id directo)
--
-- Aplica políticas CRUD a tablas que heredan el tenant desde:
--   claims, inspection_sessions, claim_actions, claim_documents,
--   claim_document_requests, inspection_damages, claim_reserves,
--   document_templates o action_template.
--
-- Saltea tablas que ya tienen company_id o estan en la lista de exclusion.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

-- Funciones helper para resolver el tenant de tablas hijas
CREATE OR REPLACE FUNCTION is_claim_tenant_allowed(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_tenant_allowed(company_id) FROM claims WHERE id = p_claim_id;
$$;

CREATE OR REPLACE FUNCTION is_session_tenant_allowed(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_tenant_allowed(company_id) FROM inspection_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION is_claim_action_tenant_allowed(p_claim_action_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_claim_tenant_allowed(claim_id) FROM claim_actions WHERE id = p_claim_action_id;
$$;

CREATE OR REPLACE FUNCTION is_claim_document_tenant_allowed(p_claim_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_claim_tenant_allowed(claim_id) FROM claim_documents WHERE id = p_claim_document_id;
$$;

CREATE OR REPLACE FUNCTION is_claim_document_request_tenant_allowed(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_tenant_allowed(company_id) FROM claim_document_requests WHERE id = p_request_id;
$$;

CREATE OR REPLACE FUNCTION is_inspection_damage_tenant_allowed(p_damage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_session_tenant_allowed(session_id) FROM inspection_damages WHERE id = p_damage_id;
$$;

CREATE OR REPLACE FUNCTION is_claim_reserve_tenant_allowed(p_reserve_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_claim_tenant_allowed(claim_id) FROM claim_reserves WHERE id = p_reserve_id;
$$;

CREATE OR REPLACE FUNCTION is_document_template_tenant_allowed(p_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_tenant_allowed(company_id) FROM document_templates WHERE id = p_template_id;
$$;

CREATE OR REPLACE FUNCTION is_action_template_tenant_allowed(p_action_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_tenant_allowed(company_id) FROM action_template WHERE id = p_action_template_id;
$$;

DO $$
DECLARE
  t record;
  p record;
  v_col text;
  v_predicate text;
  v_priority text[] := ARRAY[
    'claim_id',
    'session_id',
    'claim_action_id',
    'claim_document_id',
    'inspection_damage_id',
    'claim_reserve_id',
    'claim_document_request_id',
    'document_template_id',
    'action_template_id'
  ];
BEGIN
  FOR t IN
    SELECT tab.table_name
    FROM information_schema.tables tab
    WHERE tab.table_schema = 'public'
      AND tab.table_type = 'BASE TABLE'
      AND tab.table_name NOT IN ('_migrations', 'companies')
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = tab.table_name
          AND c.column_name = 'company_id'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = tab.table_name
          AND c.column_name = ANY(v_priority)
      )
    ORDER BY tab.table_name
  LOOP
    -- Elegir la columna de mayor prioridad (mas cercana al claim/session)
    SELECT c.column_name INTO v_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t.table_name
      AND c.column_name = ANY(v_priority)
    ORDER BY array_position(v_priority, c.column_name)
    LIMIT 1;

    -- Mapear columna a funcion tenant
    v_predicate := CASE v_col
      WHEN 'claim_id' THEN 'is_claim_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'session_id' THEN 'is_session_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'claim_action_id' THEN 'is_claim_action_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'claim_document_id' THEN 'is_claim_document_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'inspection_damage_id' THEN 'is_inspection_damage_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'claim_reserve_id' THEN 'is_claim_reserve_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'claim_document_request_id' THEN 'is_claim_document_request_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'document_template_id' THEN 'is_document_template_tenant_allowed(' || quote_ident(v_col) || ')'
      WHEN 'action_template_id' THEN 'is_action_template_tenant_allowed(' || quote_ident(v_col) || ')'
      ELSE 'false'
    END;

    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t.table_name);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t.table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (%s);',
      t.table_name || '_tenant_select', t.table_name, v_predicate
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (%s);',
      t.table_name || '_tenant_insert', t.table_name, v_predicate
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (%s) WITH CHECK (%s);',
      t.table_name || '_tenant_update', t.table_name, v_predicate, v_predicate
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (%s);',
      t.table_name || '_tenant_delete', t.table_name, v_predicate
    );
  END LOOP;
END $$;
