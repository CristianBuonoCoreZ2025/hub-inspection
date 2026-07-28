-- ═══════════════════════════════════════════════════════════════
-- Migration 270: Quitar company_id de action_template y document_requirements
--
-- Auditoría (docs/AUDITORIA_RLS_COMPANY_ID.md) confirmó:
--   - action_template: 38/38 filas NULL (100%). Nunca se setea.
--   - document_requirements: 11/11 filas NULL (100%). Nunca se setea.
--
-- Son catálogos globales de configuración. El control de permisos
-- lo hacen las server actions con requirePermission("catalogos", "edit").
--
-- Esta migración:
--   1. Dropea las políticas RLS que referencian company_id
--   2. Dropea la columna company_id
--   3. Crea políticas RLS simples (authenticated puede SELECT,
--      cualquier rol puede INSERT/UPDATE/DELETE — el control real
--      lo hace requirePermission en la server action)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. action_template ──

DROP POLICY IF EXISTS action_template_tenant_select ON action_template;
DROP POLICY IF EXISTS action_template_tenant_insert ON action_template;
DROP POLICY IF EXISTS action_template_tenant_update ON action_template;
DROP POLICY IF EXISTS action_template_tenant_delete ON action_template;

ALTER TABLE action_template DROP COLUMN IF EXISTS company_id;

-- RLS simple: authenticated puede ver, cualquier rol puede modificar
-- (el control de permisos lo hace requirePermission en server action)
CREATE POLICY action_template_select ON action_template
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY action_template_insert ON action_template
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY action_template_update ON action_template
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY action_template_delete ON action_template
  FOR DELETE TO authenticated
  USING (true);

-- ── 2. document_requirements ──

DROP POLICY IF EXISTS document_requirements_tenant_select ON document_requirements;
DROP POLICY IF EXISTS document_requirements_tenant_insert ON document_requirements;
DROP POLICY IF EXISTS document_requirements_tenant_update ON document_requirements;
DROP POLICY IF EXISTS document_requirements_tenant_delete ON document_requirements;

ALTER TABLE document_requirements DROP COLUMN IF EXISTS company_id;

CREATE POLICY document_requirements_select ON document_requirements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY document_requirements_insert ON document_requirements
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY document_requirements_update ON document_requirements
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY document_requirements_delete ON document_requirements
  FOR DELETE TO authenticated
  USING (true);
