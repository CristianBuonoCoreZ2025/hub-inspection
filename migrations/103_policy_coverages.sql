-- ═══════════════════════════════════════════════════════════════
-- Migración 103: Tabla policy_coverages
-- Almacena las coberturas que tiene una póliza.
-- Se relaciona con claims via policy_number (texto, no FK).
-- Las coberturas del siniestro (claim_coverages) pueden referenciar
-- a estas coberturas de póliza via policy_coverage_id.
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla policy_coverages
CREATE TABLE IF NOT EXISTS policy_coverages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number text NOT NULL,
  coverage_name text NOT NULL,
  subcoverage_name text,
  insured_amount numeric(18,2) DEFAULT 0,
  deductible_amount numeric(18,2) DEFAULT 0,
  currency text DEFAULT 'CLP',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_policy_coverages_number ON policy_coverages(policy_number);
CREATE INDEX IF NOT EXISTS idx_policy_coverages_active ON policy_coverages(policy_number, is_active);

-- 2. Trigger de updated_at
CREATE OR REPLACE FUNCTION trg_policy_coverages_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS policy_coverages_updated_at ON policy_coverages;
CREATE TRIGGER policy_coverages_updated_at
  BEFORE UPDATE ON policy_coverages
  FOR EACH ROW EXECUTE FUNCTION trg_policy_coverages_updated_at();

-- 3. RLS
ALTER TABLE policy_coverages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_coverages_all" ON policy_coverages;
CREATE POLICY "policy_coverages_all" ON policy_coverages
  FOR ALL USING (true) WITH CHECK (true);

-- 4. FK desde claim_coverages.policy_coverage_id → policy_coverages.id
-- (solo si no existe ya)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'claim_coverages_policy_coverage_id_fkey'
  ) THEN
    ALTER TABLE claim_coverages
      ADD CONSTRAINT claim_coverages_policy_coverage_id_fkey
      FOREIGN KEY (policy_coverage_id) REFERENCES policy_coverages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Datos de ejemplo (seed)
-- Insertar coberturas de ejemplo para pólizas existentes
INSERT INTO policy_coverages (policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency)
SELECT DISTINCT c.policy_number, 'Daño Material', 'General', 50000000, 0, 'CLP'
FROM claims c
WHERE NOT EXISTS (
  SELECT 1 FROM policy_coverages pc
  WHERE pc.policy_number = c.policy_number AND pc.coverage_name = 'Daño Material'
)
ON CONFLICT DO NOTHING;

INSERT INTO policy_coverages (policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency)
SELECT DISTINCT c.policy_number, 'Incendio', 'Estructura', 100000000, 5, 'CLP'
FROM claims c
WHERE NOT EXISTS (
  SELECT 1 FROM policy_coverages pc
  WHERE pc.policy_number = c.policy_number AND pc.coverage_name = 'Incendio'
)
ON CONFLICT DO NOTHING;

INSERT INTO policy_coverages (policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency)
SELECT DISTINCT c.policy_number, 'Robo', 'Contenidos', 20000000, 0, 'CLP'
FROM claims c
WHERE NOT EXISTS (
  SELECT 1 FROM policy_coverages pc
  WHERE pc.policy_number = c.policy_number AND pc.coverage_name = 'Robo'
)
ON CONFLICT DO NOTHING;

INSERT INTO policy_coverages (policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency)
SELECT DISTINCT c.policy_number, 'Responsabilidad Civil', 'General', 30000000, 0, 'CLP'
FROM claims c
WHERE NOT EXISTS (
  SELECT 1 FROM policy_coverages pc
  WHERE pc.policy_number = c.policy_number AND pc.coverage_name = 'Responsabilidad Civil'
)
ON CONFLICT DO NOTHING;

INSERT INTO policy_coverages (policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency)
SELECT DISTINCT c.policy_number, 'Pérdida de Beneficios', 'Lucro Cesante', 15000000, 0, 'CLP'
FROM claims c
WHERE NOT EXISTS (
  SELECT 1 FROM policy_coverages pc
  WHERE pc.policy_number = c.policy_number AND pc.coverage_name = 'Pérdida de Beneficios'
)
ON CONFLICT DO NOTHING;
