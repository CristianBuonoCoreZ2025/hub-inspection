-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 80: Add country_id and insurance_company_id to document_templates
-- Las plantillas se asocian a país, compañía de seguros y evento.
-- Renombramos company_id → insurance_company_id para claridad.
-- ═══════════════════════════════════════════════════════════════

-- Agregar country_id
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;

-- Agregar insurance_company_id (la columna company_id existente apuntaba a companies,
-- pero las plantillas se asocian a compañías de seguros, no a clientes)
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES insurance_companies(id) ON DELETE SET NULL;

-- Migrar datos: si company_id tenía valor y apunta a una insurance_company, copiarlo
UPDATE document_templates
  SET insurance_company_id = company_id
  WHERE company_id IS NOT NULL
    AND company_id IN (SELECT id FROM insurance_companies);

-- Índices
CREATE INDEX IF NOT EXISTS idx_document_templates_country
  ON document_templates(country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_templates_insurance_company
  ON document_templates(insurance_company_id) WHERE insurance_company_id IS NOT NULL;
