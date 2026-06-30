-- ============================================================
-- Hub Inspections -- Migracion 52: Restaurar status como campo
--   calculado desde status_id (lookup_catalog)
--
-- status es un enum de la aplicación (created, in_review, signed, etc.)
-- que se usa para lógica de workflow. Se sincroniza automáticamente
-- desde status_id vía trigger.
-- ============================================================

-- 1. Re-add status column
ALTER TABLE claims ADD COLUMN IF NOT EXISTS status TEXT;

-- 2. Poblar status desde lookup_catalog.code
UPDATE claims c
SET status = lc.code
FROM lookup_catalog lc
WHERE c.status_id = lc.id
  AND lc.category = 'claim_status';

-- 3. Función que sincroniza status desde status_id
CREATE OR REPLACE FUNCTION sync_claim_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    SELECT code INTO NEW.status FROM lookup_catalog WHERE id = NEW.status_id AND category = 'claim_status';
  ELSE
    NEW.status := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger: sincronizar antes de INSERT y UPDATE
DROP TRIGGER IF EXISTS sync_claim_status_trigger ON claims;
CREATE TRIGGER sync_claim_status_trigger
  BEFORE INSERT OR UPDATE OF status_id ON claims
  FOR EACH ROW EXECUTE FUNCTION sync_claim_status();

-- 5. Verificar
DO $$
DECLARE
  v_total     INTEGER;
  v_status_ok INTEGER;
BEGIN
  SELECT count(*) INTO v_total     FROM claims;
  SELECT count(*) INTO v_status_ok FROM claims WHERE status IS NOT NULL;
  RAISE NOTICE 'Migracion 52: status restaurado y sincronizado';
  RAISE NOTICE '  Total: %, status poblado: %', v_total, v_status_ok;
END $$;
