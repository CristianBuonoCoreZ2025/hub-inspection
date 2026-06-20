-- ============================================================
-- Hub Inspections — Migracion 30: Crear tabla contacts
-- Entidad reutilizable para asegurado, contratante, beneficiario, ejecutivos
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('insured', 'contractor', 'beneficiary', 'executive', 'contact', 'third_party')),
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  rut TEXT,
  email TEXT,
  phone TEXT,
  cell_phone TEXT,
  address TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  commune TEXT,
  latitude TEXT,
  longitude TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE contacts IS 'Personas reutilizables: asegurado, contratante, beneficiario, ejecutivos, contactos';

-- Index para busquedas por tipo y empresa
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts(country_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts USING gin(to_tsvector('spanish', full_name));

-- Trigger updated_at
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
