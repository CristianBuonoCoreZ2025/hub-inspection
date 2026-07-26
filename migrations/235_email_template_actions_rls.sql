-- ═══════════════════════════════════════════════════════════════
-- Migration 235: RLS sobre email_template_actions
--
-- La junction hereda el tenant de la plantilla a la que apunta.
-- Las políticas validan is_tenant_allowed(company_id de la email_template).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE email_template_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_actions FORCE ROW LEVEL SECURITY;

-- SELECT: ver vínculos de plantillas a las que el usuario tiene acceso
DROP POLICY IF EXISTS "email_template_actions_tenant_select" ON email_template_actions;
CREATE POLICY "email_template_actions_tenant_select" ON email_template_actions
  FOR SELECT TO public USING (
    is_tenant_allowed((
      SELECT e.company_id FROM email_templates e WHERE e.id = email_template_id
    ))
  );

-- INSERT: solo si la plantilla destino pertenece a un tenant permitido
DROP POLICY IF EXISTS "email_template_actions_tenant_insert" ON email_template_actions;
CREATE POLICY "email_template_actions_tenant_insert" ON email_template_actions
  FOR INSERT TO public WITH CHECK (
    is_tenant_allowed((
      SELECT e.company_id FROM email_templates e WHERE e.id = email_template_id
    ))
  );

-- UPDATE: solo cambiar is_default, y solo si la plantilla pertenece a tenant permitido
DROP POLICY IF EXISTS "email_template_actions_tenant_update" ON email_template_actions;
CREATE POLICY "email_template_actions_tenant_update" ON email_template_actions
  FOR UPDATE TO public
  USING (
    is_tenant_allowed((
      SELECT e.company_id FROM email_templates e WHERE e.id = email_template_id
    ))
  )
  WITH CHECK (
    is_tenant_allowed((
      SELECT e.company_id FROM email_templates e WHERE e.id = email_template_id
    ))
  );

-- DELETE: solo si la plantilla pertenece a tenant permitido
DROP POLICY IF EXISTS "email_template_actions_tenant_delete" ON email_template_actions;
CREATE POLICY "email_template_actions_tenant_delete" ON email_template_actions
  FOR DELETE TO public USING (
    is_tenant_allowed((
      SELECT e.company_id FROM email_templates e WHERE e.id = email_template_id
    ))
  );
