-- ═══════════════════════════════════════════════════════════════
-- Migración 105: Tabla policies + relación claims→policies
--
-- Modelo basado en el sistema legacy (SQL Server):
--   dbo.policy: póliza con cia de seguros, línea de negocio, fechas
--   dbo.policy_coverage: coberturas asociadas a una póliza
--   dbo.policy_document: documentos asociados a una póliza
--
-- Adaptaciones a PostgreSQL/Nhost:
--   - UUID en vez de bigint IDENTITY
--   - company_id → insurance_company_id (FK a insurance_companies)
--   - type_id → policy_type ('individual' | 'collective')
--   - line_of_business_id → business_line_id (FK a business_lines)
--   - currency_id → currency (text: CLP, USD, EUR, UF)
--   - broker_id → broker_id (FK a brokers)
--   - country_id → country_id (FK a countries)
--
-- Reglas de negocio:
--   - (policy_number, insurance_company_id) es UNIQUE
--   - policy_number puede ser NULL (póliza en emisión)
--   - claims.policy_id puede ser NULL (póliza pendiente)
--   - Sin policy_id → no se pueden ejecutar gestiones ni cambiar estado
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla policies
CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name text NOT NULL,
  policy_number text,  -- NULL = en emisión (sin número asignado)
  policy_type text NOT NULL DEFAULT 'individual' CHECK (policy_type IN ('individual', 'collective')),
  insurance_company_id uuid REFERENCES insurance_companies(id) ON DELETE SET NULL,
  country_id uuid REFERENCES countries(id) ON DELETE SET NULL,
  broker_id uuid REFERENCES brokers(id) ON DELETE SET NULL,
  business_line_id uuid REFERENCES business_lines(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'CLP',
  premium_amount numeric(19,5) DEFAULT 0,
  insured_amount numeric(19,5),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  comments text,
  -- Multi-tenant
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Auditoría
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Unique constraint: (policy_number, insurance_company_id)
-- Solo aplica cuando policy_number no es NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_number_company
  ON policies (policy_number, insurance_company_id)
  WHERE policy_number IS NOT NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_policies_company_id ON policies(company_id);
CREATE INDEX IF NOT EXISTS idx_policies_insurance_company ON policies(insurance_company_id);
CREATE INDEX IF NOT EXISTS idx_policies_business_line ON policies(business_line_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_number ON policies(policy_number);

-- 2. Trigger de updated_at
CREATE OR REPLACE FUNCTION trg_policies_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS policies_updated_at ON policies;
CREATE TRIGGER policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION trg_policies_updated_at();

-- 3. RLS
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policies_all" ON policies;
CREATE POLICY "policies_all" ON policies
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Agregar policy_id a claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES policies(id) ON DELETE SET NULL;

-- Migrar policy_number existentes a policy_id
-- Crear pólizas a partir de los policy_number únicos existentes en claims
INSERT INTO policies (policy_name, policy_number, insurance_company_id, business_line_id, currency, start_date, end_date, status, company_id)
SELECT DISTINCT
  c.policy_number,
  c.policy_number,
  c.insurance_company_id,
  c.business_line_id,
  'CLP',
  COALESCE(c.policy_start_date, CURRENT_DATE),
  COALESCE(c.policy_end_date, CURRENT_DATE + INTERVAL '1 year'),
  'active',
  c.company_id
FROM claims c
WHERE c.policy_number IS NOT NULL
  AND c.policy_number != ''
  AND NOT EXISTS (SELECT 1 FROM policies p WHERE p.policy_number = c.policy_number)
ON CONFLICT DO NOTHING;

-- Actualizar claims.policy_id con las pólizas recién creadas
UPDATE claims c
SET policy_id = p.id
FROM policies p
WHERE c.policy_number = p.policy_number
  AND c.policy_id IS NULL;

-- 5. Actualizar policy_coverages para usar policy_id (uuid) en vez de policy_number (text)
ALTER TABLE policy_coverages ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES policies(id) ON DELETE CASCADE;

-- Migrar policy_coverages.policy_number → policy_id
UPDATE policy_coverages pc
SET policy_id = p.id
FROM policies p
WHERE pc.policy_number = p.policy_number
  AND pc.policy_id IS NULL;

-- 6. Tabla policy_documents (documentos asociados a pólizas)
CREATE TABLE IF NOT EXISTS policy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_url text,
  document_type text,
  file_size bigint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_policy_documents_policy_id ON policy_documents(policy_id);

ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_documents_all" ON policy_documents;
CREATE POLICY "policy_documents_all" ON policy_documents
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS policy_documents_updated_at ON policy_documents;
CREATE TRIGGER policy_documents_updated_at
  BEFORE UPDATE ON policy_documents
  FOR EACH ROW EXECUTE FUNCTION trg_policies_updated_at();
