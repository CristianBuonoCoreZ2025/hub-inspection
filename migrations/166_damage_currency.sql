-- ═══════════════════════════════════════════════════════════════
-- Migration 166: Campo currency en inspection_damages
-- ═══════════════════════════════════════════════════════════════
-- Agrega columna currency para definir la moneda del monto estimado
-- de cada daño. Por defecto CLP (pesos chilenos).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE inspection_damages
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CLP';

COMMENT ON COLUMN inspection_damages.currency IS
  'Moneda del monto estimado (CLP, USD, EUR, etc.) — por defecto CLP';

-- Backfill: asegurar que todos los daños existentes tengan CLP
UPDATE inspection_damages SET currency = 'CLP' WHERE currency IS NULL OR currency = '';
