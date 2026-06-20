-- ============================================================
-- Hub Inspections — Migracion 37: Crear claim_participants
-- Reemplaza contacts: participantes especificos del siniestro
-- ============================================================

CREATE TABLE IF NOT EXISTS claim_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('insured', 'contractor', 'beneficiary', 'executive', 'contact')),
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

COMMENT ON TABLE claim_participants IS 'Participantes del siniestro: asegurado, contratante, beneficiario, ejecutivo, contacto';

CREATE INDEX IF NOT EXISTS idx_cp_claim ON claim_participants(claim_id);
CREATE INDEX IF NOT EXISTS idx_cp_type ON claim_participants(type);
CREATE INDEX IF NOT EXISTS idx_cp_name ON claim_participants USING gin(to_tsvector('spanish', full_name));

-- Constraint unica: un claim solo puede tener un asegurado, un contratante, etc.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_unique_type ON claim_participants(claim_id, type)
  WHERE type IN ('insured', 'contractor', 'beneficiary', 'executive');

DROP TRIGGER IF EXISTS claim_participants_updated_at ON claim_participants;
CREATE TRIGGER claim_participants_updated_at BEFORE UPDATE ON claim_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migrar datos desde contacts
-- ============================================================

INSERT INTO claim_participants (id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, notes, is_active, created_at, updated_at)
SELECT
  c.id,
  cl.id AS claim_id,
  c.type,
  c.full_name,
  c.first_name,
  c.last_name,
  c.rut,
  c.email,
  c.phone,
  c.cell_phone,
  c.address,
  c.country,
  c.region,
  c.city,
  c.commune,
  c.notes,
  c.is_active,
  c.created_at,
  c.updated_at
FROM contacts c
JOIN claims cl ON (
  (c.type = 'insured' AND cl.insured_id = c.id) OR
  (c.type = 'contractor' AND cl.contractor_id = c.id) OR
  (c.type = 'beneficiary' AND cl.beneficiary_id = c.id) OR
  (c.type = 'executive' AND cl.executive_id = c.id) OR
  (c.type = 'contact' AND cl.general_contact_id = c.id)
)
ON CONFLICT (id) DO NOTHING;
