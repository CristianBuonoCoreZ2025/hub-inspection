-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 73: Master de Personas
-- Crea tabla persons y person_addresses para mantener un maestro
-- de personas identificadas por país + tax_id (RUT en Chile).
-- Las direcciones se guardan por persona para reutilizar entre siniestros.
-- ═══════════════════════════════════════════════════════════════

-- Tabla maestra de personas
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  tax_id TEXT NOT NULL,          -- RUT en Chile, tax_id en otros países
  first_name TEXT NOT NULL,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_id, tax_id)
);

-- Tabla de direcciones de personas (una persona puede tener varias)
CREATE TABLE IF NOT EXISTS person_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  address TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  commune TEXT,
  source_claim_id UUID,         -- de qué siniestro se obtuvo esta dirección
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_persons_country_tax ON persons(country_id, tax_id);
CREATE INDEX IF NOT EXISTS idx_person_addresses_person ON person_addresses(person_id);

-- RLS
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_addresses ENABLE ROW LEVEL SECURITY;

-- Políticas (TO public, acceso real se controla en Hasura)
DROP POLICY IF EXISTS "persons_select" ON persons;
CREATE POLICY "persons_select" ON persons FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "persons_insert" ON persons;
CREATE POLICY "persons_insert" ON persons FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "persons_update" ON persons;
CREATE POLICY "persons_update" ON persons FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "person_addresses_select" ON person_addresses;
CREATE POLICY "person_addresses_select" ON person_addresses FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "person_addresses_insert" ON person_addresses;
CREATE POLICY "person_addresses_insert" ON person_addresses FOR INSERT TO public WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_persons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_persons_updated_at ON persons;
CREATE TRIGGER trigger_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW
  EXECUTE FUNCTION update_persons_updated_at();
