-- ============================================================
-- Migracion 54: Eliminar status (text), usar solo status_id (FK)
--
-- 1. Agregar estados faltantes a lookup_catalog (pending_info, signed)
-- 2. Sincronizar status_id para los claims que tengan status sin status_id
-- 3. Dropear trigger sync_claim_status
-- 4. Dropear columna status
-- ============================================================

-- 1. Agregar estados faltantes
INSERT INTO lookup_catalog (category, code, name, sort_order, is_active)
VALUES
  ('claim_status', 'pending_info', 'Pendiente Info', 4, true),
  ('claim_status', 'signed', 'Firmado', 6, true)
ON CONFLICT DO NOTHING;

-- 2. Sincronizar: para cualquier claim con status pero sin status_id
UPDATE claims c
SET status_id = lc.id
FROM lookup_catalog lc
WHERE c.status IS NOT NULL
  AND c.status_id IS NULL
  AND lc.category = 'claim_status'
  AND lc.code = c.status;

-- 3. Dropear trigger y funcion
DROP TRIGGER IF EXISTS sync_claim_status_trigger ON claims;
DROP FUNCTION IF EXISTS sync_claim_status();

-- 4. Dropear columna status
ALTER TABLE claims DROP COLUMN IF EXISTS status;

-- 5. Verificacion
DO $$
DECLARE
  v_total     INTEGER;
  v_status_id INTEGER;
  v_pending   INTEGER;
BEGIN
  SELECT count(*) INTO v_total     FROM claims;
  SELECT count(*) INTO v_status_id FROM claims WHERE status_id IS NOT NULL;
  SELECT count(*) INTO v_pending   FROM claims WHERE status_id IS NULL;
  RAISE NOTICE 'Migracion 54: status dropeado, solo status_id';
  RAISE NOTICE '  Total: %, con status_id: %, sin status_id: %', v_total, v_status_id, v_pending;
END $$;
