-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 83: Change liquidation_number to 10 digits
-- Formato anterior: L-0000001 (7 dígitos)
-- Formato nuevo:    L-0000000001 (10 dígitos)
-- ═══════════════════════════════════════════════════════════════

-- 1. Actualizar función para generar con 10 dígitos
CREATE OR REPLACE FUNCTION generate_liquidation_number()
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('claims_liquidation_seq');
  RETURN 'L-' || LPAD(next_val::TEXT, 10, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Migrar liquidation_numbers existentes de 7 a 10 dígitos
--    L-0000001 → L-0000000001
UPDATE claims
  SET liquidation_number = 'L-' || LPAD(
    SUBSTRING(liquidation_number FROM 3), 10, '0'
  )
  WHERE liquidation_number ~ '^L-[0-9]{7}$';
