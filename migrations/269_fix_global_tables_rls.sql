-- ═══════════════════════════════════════════════════════════════
-- Migration 269: Fix RLS de tablas globales (company_id NULL)
--
-- Auditoría (docs/AUDITORIA_RLS_COMPANY_ID.md) detectó 3 tablas con
-- filas company_id = NULL (globales) pero RLS que EXIGE
-- is_tenant_allowed(company_id) → devuelve false para NULL → bloqueadas.
--
-- Tablas corregidas:
--   1. action_template (38 filas, 100% NULL)
--      - DELETE e INSERT (UPDATE ya corregido en migración 268)
--   2. document_requirements (11 filas, 100% NULL)
--      - SELECT, INSERT, UPDATE, DELETE
--   3. document_templates (4 de 6 filas NULL)
--      - SELECT, INSERT, UPDATE, DELETE
--
-- Patrón: (company_id IS NULL) OR is_tenant_allowed(company_id)
-- El control de permisos lo hacen las server actions con requirePermission.
-- La RLS solo asegura aislamiento entre tenants; las filas globales (NULL)
-- son visibles/editables para usuarios autenticados con permiso.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. action_template: DELETE e INSERT (UPDATE y SELECT ya OK) ──

DROP POLICY IF EXISTS action_template_tenant_delete ON action_template;
CREATE POLICY action_template_tenant_delete ON action_template
  FOR DELETE
  USING ((company_id IS NULL) OR is_tenant_allowed(company_id));

DROP POLICY IF EXISTS action_template_tenant_insert ON action_template;
CREATE POLICY action_template_tenant_insert ON action_template
  FOR INSERT
  WITH CHECK ((company_id IS NULL) OR is_tenant_allowed(company_id));

-- ── 2. document_requirements: SELECT, INSERT, UPDATE, DELETE ──

DROP POLICY IF EXISTS document_requirements_tenant_select ON document_requirements;
CREATE POLICY document_requirements_tenant_select ON document_requirements
  FOR SELECT
  USING ((company_id IS NULL) OR is_tenant_allowed(company_id));

DROP POLICY IF EXISTS document_requirements_tenant_insert ON document_requirements;
CREATE POLICY document_requirements_tenant_insert ON document_requirements
  FOR INSERT
  WITH CHECK ((company_id IS NULL) OR is_tenant_allowed(company_id));

DROP POLICY IF EXISTS document_requirements_tenant_update ON document_requirements;
CREATE POLICY document_requirements_tenant_update ON document_requirements
  FOR UPDATE
  USING ((company_id IS NULL) OR is_tenant_allowed(company_id))
  WITH CHECK ((company_id IS NULL) OR is_tenant_allowed(company_id));

DROP POLICY IF EXISTS document_requirements_tenant_delete ON document_requirements;
CREATE POLICY document_requirements_tenant_delete ON document_requirements
  FOR DELETE
  USING ((company_id IS NULL) OR is_tenant_allowed(company_id));

-- ── 3. document_templates: SELECT, INSERT, UPDATE, DELETE ──

DROP POLICY IF EXISTS document_templates_tenant_select ON document_templates;
CREATE POLICY document_templates_tenant_select ON document_templates
  FOR SELECT
  USING ((company_id IS NULL) OR is_tenant_allowed(company_id));

DROP POLICY IF EXISTS document_templates_tenant_insert ON document_templates;
CREATE POLICY document_templates_tenant_insert ON document_templates
  FOR INSERT
  WITH CHECK ((company_id IS NULL) OR is_tenant_allowed(company_id));

DROP POLICY IF EXISTS document_templates_tenant_update ON document_templates;
CREATE POLICY document_templates_tenant_update ON document_templates
  FOR UPDATE
  USING ((company_id IS NULL) OR is_tenant_allowed(company_id))
  WITH CHECK ((company_id IS NULL) OR is_tenant_allowed(company_id));

DROP POLICY IF EXISTS document_templates_tenant_delete ON document_templates;
CREATE POLICY document_templates_tenant_delete ON document_templates
  FOR DELETE
  USING ((company_id IS NULL) OR is_tenant_allowed(company_id));
