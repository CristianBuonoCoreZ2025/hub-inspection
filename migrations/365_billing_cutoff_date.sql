-- ═══════════════════════════════════════════════════════════════
-- Migración 365: Fecha de corte para nóminas de facturación
-- ═══════════════════════════════════════════════════════════════
--
-- Agrega cutoff_date a billing_batches e inspection_billing_batches.
-- Al generar una nómina, solo se incluyen inspecciones con
-- ended_at/inspection_date <= cutoff_date (inclusive, todo el día).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE billing_batches
  ADD COLUMN IF NOT EXISTS cutoff_date DATE;

ALTER TABLE inspection_billing_batches
  ADD COLUMN IF NOT EXISTS cutoff_date DATE;
