-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 58: Correlativo único de inspección por siniestro
-- Formato: {liquidation_number}-I-{seq:3}
-- Ejemplo: L-0000123-I-001, L-0000123-I-002, L-0000456-I-001
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna inspection_number a inspection_sessions
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS inspection_number text;

-- 2. Función para generar el correlativo de inspección
--    Busca el liquidation_number del claim y el siguiente correlativo
CREATE OR REPLACE FUNCTION generate_inspection_number()
RETURNS TEXT AS $$
DECLARE
  v_claim_id uuid;
  v_liquidation text;
  v_max_seq int;
  v_new_seq text;
BEGIN
  -- Esta función se llama desde el trigger con NEW.claim_id
  -- Se implementa directamente en el trigger
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Función trigger para auto-generar inspection_number al insertar
CREATE OR REPLACE FUNCTION set_inspection_number()
RETURNS TRIGGER AS $$
DECLARE
  v_liquidation text;
  v_max_seq int;
  v_new_seq text;
BEGIN
  IF NEW.inspection_number IS NULL OR NEW.inspection_number = '' THEN
    -- Obtener liquidation_number del claim
    SELECT liquidation_number INTO v_liquidation
    FROM claims WHERE id = NEW.claim_id;

    IF v_liquidation IS NULL THEN
      v_liquidation := 'UNKNOWN';
    END IF;

    -- Contar inspecciones existentes para este claim (incluyendo esta)
    SELECT count(*) INTO v_max_seq
    FROM inspection_sessions
    WHERE claim_id = NEW.claim_id;

    v_new_seq := LPAD((v_max_seq + 1)::text, 3, '0');
    NEW.inspection_number := v_liquidation || '-I-' || v_new_seq;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_set_inspection_number ON inspection_sessions;
CREATE TRIGGER trg_set_inspection_number
BEFORE INSERT ON inspection_sessions
FOR EACH ROW
EXECUTE FUNCTION set_inspection_number();

-- 5. Backfill: generar inspection_number para sesiones existentes
DO $$
DECLARE
  r RECORD;
  v_liquidation text;
  v_seq int;
  v_new_seq text;
BEGIN
  FOR r IN
    SELECT id, claim_id FROM inspection_sessions
    WHERE inspection_number IS NULL OR inspection_number = ''
    ORDER BY created_at ASC
  LOOP
    SELECT liquidation_number INTO v_liquidation
    FROM claims WHERE id = r.claim_id;

    IF v_liquidation IS NULL THEN
      v_liquidation := 'UNKNOWN';
    END IF;

    -- Contar cuántas inspecciones previas tiene este claim (con created_at menor)
    SELECT count(*) INTO v_seq
    FROM inspection_sessions
    WHERE claim_id = r.claim_id AND created_at < r.created_at;

    v_new_seq := LPAD((v_seq + 1)::text, 3, '0');

    UPDATE inspection_sessions
    SET inspection_number = v_liquidation || '-I-' || v_new_seq
    WHERE id = r.id;

  END LOOP;
END$$;
