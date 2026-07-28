-- ═══════════════════════════════════════════════════════════════
-- Migration 266: Agregar policy_item a policies + UNIQUE constraint
--
-- El chequeo único de póliza es: policy_number + insurance_company_id + policy_item
-- (item default '0' si viene vacío).
--
-- Ver docs/CARGA_SINIESTROS.md sección "Vinculación de Pólizas".
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna policy_item (default '0' para pólizas existentes)
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS policy_item text NOT NULL DEFAULT '0';

-- 2. Setear item='0' en pólizas existentes que tengan null (no debería, pero por seguridad)
UPDATE policies SET policy_item = '0' WHERE policy_item IS NULL OR policy_item = '';

-- 3. Constraint UNIQUE: una póliza es única por empresa + número + cia + item
CREATE UNIQUE INDEX IF NOT EXISTS uq_policies_company_number_cia_item
  ON policies (company_id, policy_number, insurance_company_id, policy_item)
  WHERE policy_number IS NOT NULL AND insurance_company_id IS NOT NULL;

-- 4. Comentario
COMMENT ON COLUMN policies.policy_item IS
  'Item/ramo de la póliza. Default ''0''. Chequeo único: company_id + policy_number + insurance_company_id + policy_item.';
