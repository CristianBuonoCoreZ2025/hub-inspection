-- ═══════════════════════════════════════════════════════════════
-- Migración 112: Corregir modelo de pólizas
--
-- 1. Una póliza puede tener múltiples líneas de negocio
--    → Crear tabla policy_business_lines
--    → Migrar business_line_id existentes a la nueva tabla
--    → Mantener business_line_id en policies como campo principal (legacy)
--      pero la tabla intermedia es la fuente de verdad
--
-- 2. Coberturas: insured_amount y deductible_amount son opcionales
--    → Cambiar DEFAULT 0 a NULL (para distinguir "no tiene" de "es 0")
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Tabla policy_business_lines (relación N:M)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS policy_business_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  business_line_id uuid NOT NULL REFERENCES business_lines(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(policy_id, business_line_id)
);

CREATE INDEX IF NOT EXISTS idx_pbl_policy ON policy_business_lines(policy_id);
CREATE INDEX IF NOT EXISTS idx_pbl_business_line ON policy_business_lines(business_line_id);

ALTER TABLE policy_business_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_business_lines_all" ON policy_business_lines;
CREATE POLICY "policy_business_lines_all" ON policy_business_lines
  FOR ALL USING (true) WITH CHECK (true);

-- Migrar business_line_id existentes a la nueva tabla
INSERT INTO policy_business_lines (policy_id, business_line_id, is_primary)
SELECT id, business_line_id, true
FROM policies
WHERE business_line_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM policy_business_lines pbl
    WHERE pbl.policy_id = policies.id AND pbl.business_line_id = policies.business_line_id
  )
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. Coberturas: insured_amount y deductible_amount opcionales
-- ═══════════════════════════════════════════════════════════════
-- Cambiar DEFAULT de 0 a NULL para distinguir "no aplica" de "monto cero"
ALTER TABLE policy_coverages ALTER COLUMN insured_amount DROP NOT NULL;
ALTER TABLE policy_coverages ALTER COLUMN insured_amount SET DEFAULT NULL;
ALTER TABLE policy_coverages ALTER COLUMN deductible_amount DROP NOT NULL;
ALTER TABLE policy_coverages ALTER COLUMN deductible_amount SET DEFAULT NULL;

-- Trackear la nueva tabla en Hasura (se hace con el script hasura-track-tables.ts)
