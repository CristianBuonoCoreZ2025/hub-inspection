-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 79: Add insurance_company_id to action_template
-- La gestión se asocia a la compañía de seguros (insurance_companies),
-- no al cliente (companies). McLarens trabaja para compañías de seguros.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES insurance_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_action_template_insurance_company
  ON action_template(insurance_company_id) WHERE insurance_company_id IS NOT NULL;
