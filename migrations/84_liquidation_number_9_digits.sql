-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 84: Change liquidation_number to 9 digits
-- Formato: L-NNNNNNNNN (L + 9 dígitos, ej: L-000000001)
-- ═══════════════════════════════════════════════════════════════

-- 1. Actualizar función para generar con 9 dígitos
CREATE OR REPLACE FUNCTION generate_liquidation_number()
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('claims_liquidation_seq');
  RETURN 'L-' || LPAD(next_val::TEXT, 9, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Migrar liquidation_numbers existentes de 10 a 9 dígitos
--    L-0000000001 → L-000000001
UPDATE claims
  SET liquidation_number = 'L-' || LPAD(
    SUBSTRING(liquidation_number FROM 3), 9, '0'
  )
  WHERE liquidation_number ~ '^L-[0-9]+$';
