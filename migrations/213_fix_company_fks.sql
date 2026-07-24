-- ═══════════════════════════════════════════════════════════════
-- Migration 213: FKs faltantes para company_id
--
-- El audit encontró columnas company_id existentes sin FK a companies.
-- Esto puede generar datos huérfanos y romper joins de RLS.
-- Solo se agregan constraints, NO se borran ni modifican datos.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'claim_document_requests'
      AND constraint_name = 'claim_document_requests_company_id_fkey'
  ) THEN
    ALTER TABLE claim_document_requests
      ADD CONSTRAINT claim_document_requests_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'document_requirements'
      AND constraint_name = 'document_requirements_company_id_fkey'
  ) THEN
    ALTER TABLE document_requirements
      ADD CONSTRAINT document_requirements_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;
