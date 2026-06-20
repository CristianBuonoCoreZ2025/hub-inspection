-- ============================================================
-- Hub Inspections — Migracion 32: Crear claims_carga (staging para Excel)
-- Tabla temporal que recibe el Excel crudo antes de distribuir a claims/contacts
-- ============================================================

CREATE TABLE IF NOT EXISTS claims_carga (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  raw_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE claims_carga IS 'Staging: datos crudos del Excel antes de ser distribuidos a claims/contacts';

CREATE INDEX IF NOT EXISTS idx_claims_carga_status ON claims_carga(status);
CREATE INDEX IF NOT EXISTS idx_claims_carga_company ON claims_carga(company_id);
CREATE INDEX IF NOT EXISTS idx_claims_carga_claim ON claims_carga(claim_id);

DROP TRIGGER IF EXISTS claims_carga_updated_at ON claims_carga;
CREATE TRIGGER claims_carga_updated_at BEFORE UPDATE ON claims_carga
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
