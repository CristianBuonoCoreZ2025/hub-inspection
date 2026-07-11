-- ═══════════════════════════════════════════════════════════════
-- Migración 106: Campos de ajuste en reserve_coverages
--
-- Problema: El ajuste sobrescribía reserved_amount y deductible_amount,
-- perdiéndose el valor original reservado.
--
-- Solución: Agregar campos separados para el ajuste:
--   adjusted_amount        — monto ajustado (reemplaza al reservado)
--   adjusted_deductible    — deducible ajustado
--   adjusted_net           — neto del ajuste (adjusted_amount - adjusted_deductible)
--   adjustment_notes       — notas del ajuste por cobertura
--   adjusted_at            — fecha del ajuste
--
-- También agregar campos a claim_reserves:
--   adjusted_amount        — total ajustado
--   adjusted_deductible    — total deducible ajustado
--   adjusted_final_amount  — total final ajustado
--   adjusted_at            — fecha del ajuste
-- ═══════════════════════════════════════════════════════════════

-- 1. Campos de ajuste por cobertura
ALTER TABLE reserve_coverages ADD COLUMN IF NOT EXISTS adjusted_amount numeric(18,2);
ALTER TABLE reserve_coverages ADD COLUMN IF NOT EXISTS adjusted_deductible numeric(18,2);
ALTER TABLE reserve_coverages ADD COLUMN IF NOT EXISTS adjusted_net numeric(18,2);
ALTER TABLE reserve_coverages ADD COLUMN IF NOT EXISTS adjustment_notes text;
ALTER TABLE reserve_coverages ADD COLUMN IF NOT EXISTS adjusted_at timestamptz;

-- 2. Campos de ajuste a nivel de reserva
ALTER TABLE claim_reserves ADD COLUMN IF NOT EXISTS adjusted_amount numeric(18,2) DEFAULT 0;
ALTER TABLE claim_reserves ADD COLUMN IF NOT EXISTS adjusted_deductible numeric(18,2) DEFAULT 0;
ALTER TABLE claim_reserves ADD COLUMN IF NOT EXISTS adjusted_final_amount numeric(18,2) DEFAULT 0;
ALTER TABLE claim_reserves ADD COLUMN IF NOT EXISTS adjusted_at timestamptz;
ALTER TABLE claim_reserves ADD COLUMN IF NOT EXISTS adjustment_notes text;
