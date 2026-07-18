-- ═══════════════════════════════════════════════════════════════
-- Migration 169: Tipo de fecha de referencia para conversiones de moneda
-- ═══════════════════════════════════════════════════════════════
-- Cada país define qué fecha usar como referencia al convertir montos
-- a la moneda base:
--   claim_date     = fecha del siniestro (Chile, Argentina)
--   execution_date = fecha de ejecución de la gestión (Perú, Colombia)
--
-- Esto afecta qué tipo de cambio se usa para convertir
-- ej: un daño en USD se convierte a CLP usando la tasa del día del siniestro
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE countries ADD COLUMN IF NOT EXISTS reference_date_type text NOT NULL DEFAULT 'claim_date';

COMMENT ON COLUMN countries.reference_date_type IS 'Fecha de referencia para conversiones: claim_date o execution_date';

-- Chile, Argentina, Bolivia, Paraguay → claim_date (default)
-- Perú, Colombia, Brasil → execution_date
UPDATE countries SET reference_date_type = 'execution_date' WHERE code IN ('PE', 'CO', 'BR');
UPDATE countries SET reference_date_type = 'claim_date' WHERE code IN ('CL', 'AR', 'BO', 'PY', 'EC');
