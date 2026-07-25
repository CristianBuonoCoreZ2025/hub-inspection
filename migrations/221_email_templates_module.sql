-- ═══════════════════════════════════════════════════════════════
-- Migration 221: Módulo Plantillas de E-mail
--
-- Crea tablas email_templates y email_logs, y agrega switches de
-- emisión/envío automático a action_template.
-- ═══════════════════════════════════════════════════════════════

-- ═══ Tabla: email_templates ═══
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  business_line_id UUID REFERENCES business_lines(id) ON DELETE SET NULL,
  action_template_id UUID NOT NULL REFERENCES action_template(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  detected_placeholders JSONB NOT NULL DEFAULT '[]'::jsonb,
  placeholder_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_action_business
  ON email_templates(action_template_id, business_line_id, is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_company
  ON email_templates(company_id);

-- ═══ Tabla: email_logs ═══
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_action_id UUID NOT NULL REFERENCES claim_actions(id) ON DELETE CASCADE,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  to_address TEXT[] NOT NULL,
  cc_address TEXT[] NOT NULL DEFAULT '{}',
  bcc_address TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  provider_response JSONB,
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_claim_action
  ON email_logs(claim_action_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_claim
  ON email_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_company
  ON email_logs(company_id);

-- ═══ Columnas de auto emisión/envío en action_template ═══
ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS auto_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_email BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL;

-- ═══ RLS ═══
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_tenant_select" ON email_templates
  FOR SELECT USING (is_tenant_allowed(company_id));
CREATE POLICY "email_templates_tenant_insert" ON email_templates
  FOR INSERT WITH CHECK (is_tenant_allowed(company_id));
CREATE POLICY "email_templates_tenant_update" ON email_templates
  FOR UPDATE USING (is_tenant_allowed(company_id)) WITH CHECK (is_tenant_allowed(company_id));
CREATE POLICY "email_templates_tenant_delete" ON email_templates
  FOR DELETE USING (is_tenant_allowed(company_id));

CREATE POLICY "email_logs_tenant_select" ON email_logs
  FOR SELECT USING (is_tenant_allowed(company_id));
CREATE POLICY "email_logs_tenant_insert" ON email_logs
  FOR INSERT WITH CHECK (is_tenant_allowed(company_id));
CREATE POLICY "email_logs_tenant_update" ON email_logs
  FOR UPDATE USING (is_tenant_allowed(company_id)) WITH CHECK (is_tenant_allowed(company_id));
CREATE POLICY "email_logs_tenant_delete" ON email_logs
  FOR DELETE USING (is_tenant_allowed(company_id));
