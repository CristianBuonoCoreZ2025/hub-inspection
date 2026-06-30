-- ============================================================
-- Hub Inspections -- Migracion 50: Migrar campos de texto a FKs (IDs)
--
-- 1. Crear monedas en lookup_catalog (category='currency')
-- 2. Migrar event (texto) -> event_id (UUID)
-- 3. Migrar status (texto) -> status_id (UUID)
-- 4. Migrar policy_currency (texto) -> currency_id (UUID)
-- 5. Drop columna claim_reference (ya reemplazada por client_reference)
--
-- Los campos geo (country_id, region_id, city_id, commune_id)
-- ya estaban poblados correctamente desde migraciones anteriores.
-- ============================================================

-- ============================================================
-- 1. Crear monedas en lookup_catalog (category='currency')
-- ============================================================
INSERT INTO lookup_catalog (country_id, category, code, name, is_active) VALUES
  ((SELECT id FROM countries WHERE code = 'CL'), 'currency', 'CLP', 'Peso Chileno', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'currency', 'UF',  'Unidad de Fomento', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'currency', 'USD', 'Dólar Americano', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'currency', 'EUR', 'Euro', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Migrar event (texto) -> event_id (UUID)
--    Match por nombre en tabla events
-- ============================================================
UPDATE claims c
SET event_id = e.id
FROM events e
WHERE c.event IS NOT NULL
  AND c.event_id IS NULL
  AND LOWER(TRIM(c.event)) = LOWER(TRIM(e.name));

-- ============================================================
-- 3. Migrar status (texto) -> status_id (UUID)
--    Match por code en lookup_catalog(category='claim_status')
-- ============================================================
UPDATE claims c
SET status_id = lc.id
FROM lookup_catalog lc
WHERE c.status IS NOT NULL
  AND c.status_id IS NULL
  AND lc.category = 'claim_status'
  AND lc.code = c.status;

-- ============================================================
-- 4. Migrar policy_currency (texto) -> currency_id (UUID)
--    Match por nombre en lookup_catalog(category='currency')
-- ============================================================
UPDATE claims c
SET currency_id = lc.id
FROM lookup_catalog lc
WHERE c.policy_currency IS NOT NULL
  AND c.currency_id IS NULL
  AND lc.category = 'currency'
  AND LOWER(TRIM(c.policy_currency)) = LOWER(TRIM(lc.name));

-- ============================================================
-- 5. Drop columna claim_reference (ya reemplazada por client_reference)
-- ============================================================
ALTER TABLE claims DROP COLUMN IF EXISTS claim_reference;

-- ============================================================
-- Verificacion: mostrar counts de lo migrado
-- ============================================================
DO $$
DECLARE
  v_total       INTEGER;
  v_event_ok    INTEGER;
  v_status_ok   INTEGER;
  v_currency_ok INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM claims;
  SELECT count(*) INTO v_event_ok    FROM claims WHERE event_id    IS NOT NULL;
  SELECT count(*) INTO v_status_ok   FROM claims WHERE status_id   IS NOT NULL;
  SELECT count(*) INTO v_currency_ok FROM claims WHERE currency_id IS NOT NULL;

  RAISE NOTICE 'Migracion 50 completada:';
  RAISE NOTICE '  Total claims:        %', v_total;
  RAISE NOTICE '  event_id poblado:    %', v_event_ok;
  RAISE NOTICE '  status_id poblado:   %', v_status_ok;
  RAISE NOTICE '  currency_id poblado: %', v_currency_ok;
END $$;
