-- Hub Inspections — Migracion 49: Add liquidation_number auto-sequence
--
-- El mapeo form → DB ya es correcto:
--   Form 'N° Interno Cliente' (clientReference) → DB client_reference
--   Form 'N° Siniestro Cía' (claimNumber)       → DB claim_number
--   company_report_number                        → null por ahora
--
-- Esta migracion:
--   1. Crea secuencia para liquidation_number (correlativo unico: L-0000001)
--   2. Trigger para auto-generar al insertar
--   3. Limpia company_report_number (deja null)
--   4. Alinea la secuencia con liquidation_number existentes

-- 1. Crear secuencia para correlativo de liquidacion
CREATE SEQUENCE IF NOT EXISTS claims_liquidation_seq START 1;

-- 2. Funcion para generar liquidation_number: L-0000001
CREATE OR REPLACE FUNCTION generate_liquidation_number()
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('claims_liquidation_seq');
  RETURN 'L-' || LPAD(next_val::TEXT, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Funcion trigger para auto-generar liquidation_number al insertar
CREATE OR REPLACE FUNCTION set_liquidation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.liquidation_number IS NULL OR NEW.liquidation_number = '' THEN
    NEW.liquidation_number := generate_liquidation_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_claims_liquidation_number ON claims;
CREATE TRIGGER trg_claims_liquidation_number
BEFORE INSERT ON claims
FOR EACH ROW
EXECUTE FUNCTION set_liquidation_number();

-- 5. Limpiar company_report_number (dejar null por ahora)
UPDATE claims SET company_report_number = NULL;

-- 6. Alinear la secuencia con liquidation_number existentes
DO $$
DECLARE
  max_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN liquidation_number ~ '^L-[0-9]+$'
      THEN CAST(SUBSTRING(liquidation_number FROM 3) AS BIGINT)
      ELSE 0
    END
  ), 0) INTO max_seq FROM claims;

  IF max_seq > 0 THEN
    PERFORM setval('claims_liquidation_seq', max_seq);
  END IF;
END$$;
