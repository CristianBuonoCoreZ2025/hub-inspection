-- ============================================================
-- Hub Inspections -- Migracion 53: Trigger bidireccional status <-> status_id
--
-- Problema: la app escribe status directamente (updateClaimStatus),
--   pero el trigger anterior solo sincronizaba status desde status_id.
--   Al cambiar status, status_id quedaba desactualizado.
--
-- Solucion: trigger bidireccional con guardia anti-loop.
--   - Si cambia status_id  -> sincroniza status desde lookup_catalog.code
--   - Si cambia status      -> sincroniza status_id desde lookup_catalog.code
-- ============================================================

CREATE OR REPLACE FUNCTION sync_claim_status()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_id   UUID;
BEGIN
  -- Solo procesar si alguno de los dos campos cambio
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    -- status_id cambio -> derivar status desde lookup_catalog
    IF NEW.status_id IS NOT NULL THEN
      SELECT code INTO v_code FROM lookup_catalog WHERE id = NEW.status_id AND category = 'claim_status';
      IF v_code IS NOT NULL THEN
        NEW.status := v_code;
      END IF;
    ELSE
      NEW.status := NULL;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- status cambio -> derivar status_id desde lookup_catalog
    IF NEW.status IS NOT NULL THEN
      SELECT id INTO v_id FROM lookup_catalog WHERE code = NEW.status AND category = 'claim_status';
      IF v_id IS NOT NULL THEN
        NEW.status_id := v_id;
      END IF;
    ELSE
      NEW.status_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reemplazar el trigger anterior (que solo escuchaba status_id)
DROP TRIGGER IF EXISTS sync_claim_status_trigger ON claims;
CREATE TRIGGER sync_claim_status_trigger
  BEFORE INSERT OR UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION sync_claim_status();

-- Verificar que todos los claims tengan ambos campos sincronizados
UPDATE claims c
SET status_id = lc.id
FROM lookup_catalog lc
WHERE c.status IS NOT NULL
  AND c.status_id IS NULL
  AND lc.category = 'claim_status'
  AND lc.code = c.status;

UPDATE claims c
SET status = lc.code
FROM lookup_catalog lc
WHERE c.status_id IS NOT NULL
  AND c.status IS NULL
  AND lc.category = 'claim_status'
  AND lc.id = c.status_id;

DO $$
DECLARE
  v_total     INTEGER;
  v_status    INTEGER;
  v_status_id INTEGER;
  v_synced    INTEGER;
BEGIN
  SELECT count(*) INTO v_total     FROM claims;
  SELECT count(*) INTO v_status    FROM claims WHERE status IS NOT NULL;
  SELECT count(*) INTO v_status_id FROM claims WHERE status_id IS NOT NULL;
  SELECT count(*) INTO v_synced    FROM claims c
    JOIN lookup_catalog lc ON c.status_id = lc.id AND lc.category = 'claim_status'
    WHERE c.status = lc.code;
  RAISE NOTICE 'Migracion 53: trigger bidireccional status <-> status_id';
  RAISE NOTICE '  Total: %, status: %, status_id: %, synced: %', v_total, v_status, v_status_id, v_synced;
END $$;
