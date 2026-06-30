-- ============================================================
-- Hub Inspections -- Migracion 51: Dropear columnas de texto
--   que ya tienen FK _id correspondiente
--
-- 1. Fix 13 claims con geo FKs faltantes (matching por sinónimos)
-- 2. Crear ciudades/communes faltantes
-- 3. Dropear columnas de texto: event, status, policy_currency,
--    claim_country, claim_region, claim_city, claim_commune
-- 4. Migrar recovery_type_legal / recovery_type_material a boolean
-- ============================================================

-- ============================================================
-- 1. FIX REGION_ID — sinónimos de nombres de regiones
-- ============================================================

-- "Región Metropolitana" → "Región Metropolitana" (match exacto case-insensitive)
UPDATE claims c
SET region_id = r.id,
    country_id = co.id
FROM regions r
JOIN countries co ON r.country_id = co.id
WHERE c.region_id IS NULL
  AND c.claim_region ILIKE 'Región Metropolitana'
  AND r.name ILIKE 'Región Metropolitana'
  AND co.code = 'CL';

-- "Aysén del General Carlos Ibáñez del Campo" → "XI Región"
UPDATE claims c
SET region_id = r.id,
    country_id = co.id
FROM regions r
JOIN countries co ON r.country_id = co.id
WHERE c.region_id IS NULL
  AND c.claim_region ILIKE 'Aysén%'
  AND r.code = '11'
  AND co.code = 'CL';

-- "Ñuble" → "X Región" (code 10)
UPDATE claims c
SET region_id = r.id,
    country_id = co.id
FROM regions r
JOIN countries co ON r.country_id = co.id
WHERE c.region_id IS NULL
  AND c.claim_region ILIKE 'Ñuble'
  AND r.code = '10'
  AND co.code = 'CL';

-- "Valparaíso" → "V Región" (code 05) — ya estaban la mayoría,
--   pero por si quedó alguno sin match
UPDATE claims c
SET region_id = r.id,
    country_id = co.id
FROM regions r
JOIN countries co ON r.country_id = co.id
WHERE c.region_id IS NULL
  AND c.claim_region ILIKE 'Valparaíso'
  AND r.code = '05'
  AND co.code = 'CL';

-- ============================================================
-- 2. CREAR CIUDADES FALTANTES y asignar city_id
-- ============================================================

-- "Marga Marga" — provincia/ciudad en V Región (Valparaíso)
INSERT INTO cities (region_id, name)
SELECT r.id, 'Marga Marga'
FROM regions r
WHERE r.code = '05'
ON CONFLICT DO NOTHING;

UPDATE claims c
SET city_id = ci.id
FROM cities ci
JOIN regions r ON ci.region_id = r.id
WHERE c.city_id IS NULL
  AND c.claim_city ILIKE 'Marga Marga'
  AND r.code = '05';

-- "Coyhaique" — ciudad en XI Región (Aysén)
INSERT INTO cities (region_id, name)
SELECT r.id, 'Coyhaique'
FROM regions r
WHERE r.code = '11'
ON CONFLICT DO NOTHING;

UPDATE claims c
SET city_id = ci.id
FROM cities ci
JOIN regions r ON ci.region_id = r.id
WHERE c.city_id IS NULL
  AND c.claim_city ILIKE 'Coyhaique'
  AND r.code = '11';

-- "Diguillín" — ciudad/provincia en X Región (Ñuble)
INSERT INTO cities (region_id, name)
SELECT r.id, 'Diguillín'
FROM regions r
WHERE r.code = '10'
ON CONFLICT DO NOTHING;

UPDATE claims c
SET city_id = ci.id
FROM cities ci
JOIN regions r ON ci.region_id = r.id
WHERE c.city_id IS NULL
  AND c.claim_city ILIKE 'Diguillín'
  AND r.code = '10';

-- "Chacabuco" ya existe en RM (region code 13)
UPDATE claims c
SET city_id = ci.id
FROM cities ci
JOIN regions r ON ci.region_id = r.id
WHERE c.city_id IS NULL
  AND c.claim_city ILIKE 'Chacabuco'
  AND r.code = '13';

-- ============================================================
-- 3. CREAR COMMUNES FALTANTES y asignar commune_id
-- ============================================================

-- "Concón" — comuna en V Región, ciudad Valparaíso
INSERT INTO communes (city_id, name)
SELECT ci.id, 'Concón'
FROM cities ci
JOIN regions r ON ci.region_id = r.id
WHERE ci.name = 'Valparaíso' AND r.code = '05'
ON CONFLICT DO NOTHING;

UPDATE claims c
SET commune_id = cm.id
FROM communes cm
JOIN cities ci ON cm.city_id = ci.id
JOIN regions r ON ci.region_id = r.id
WHERE c.commune_id IS NULL
  AND c.claim_commune ILIKE 'Concón'
  AND r.code = '05';

-- "Chillán Viejo" — comuna en X Región (Ñuble), ciudad Diguillín
INSERT INTO communes (city_id, name)
SELECT ci.id, 'Chillán Viejo'
FROM cities ci
JOIN regions r ON ci.region_id = r.id
WHERE ci.name = 'Diguillín' AND r.code = '10'
ON CONFLICT DO NOTHING;

UPDATE claims c
SET commune_id = cm.id
FROM communes cm
JOIN cities ci ON cm.city_id = ci.id
JOIN regions r ON ci.region_id = r.id
WHERE c.commune_id IS NULL
  AND c.claim_commune ILIKE 'Chillán Viejo'
  AND r.code = '10';

-- "Coyhaique" — comuna en XI Región, ciudad Coyhaique
INSERT INTO communes (city_id, name)
SELECT ci.id, 'Coyhaique'
FROM cities ci
JOIN regions r ON ci.region_id = r.id
WHERE ci.name = 'Coyhaique' AND r.code = '11'
ON CONFLICT DO NOTHING;

UPDATE claims c
SET commune_id = cm.id
FROM communes cm
JOIN cities ci ON cm.city_id = ci.id
JOIN regions r ON ci.region_id = r.id
WHERE c.commune_id IS NULL
  AND c.claim_commune ILIKE 'Coyhaique'
  AND r.code = '11';

-- "Colina" — ya existe en RM, ciudad Chacabuco
UPDATE claims c
SET commune_id = cm.id
FROM communes cm
JOIN cities ci ON cm.city_id = ci.id
JOIN regions r ON ci.region_id = r.id
WHERE c.commune_id IS NULL
  AND c.claim_commune ILIKE 'Colina'
  AND r.code = '13';

-- ============================================================
-- 4. FIX recovery_type_legal / recovery_type_material → boolean
--    (actualmente son text, todos NULL)
-- ============================================================
ALTER TABLE claims ALTER COLUMN recovery_type_legal TYPE BOOLEAN USING NULL;
ALTER TABLE claims ALTER COLUMN recovery_type_material TYPE BOOLEAN USING NULL;

-- ============================================================
-- 5. DROP columnas de texto que ya tienen FK _id
-- ============================================================
ALTER TABLE claims DROP COLUMN IF EXISTS event;
ALTER TABLE claims DROP COLUMN IF EXISTS status;
ALTER TABLE claims DROP COLUMN IF EXISTS policy_currency;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_country;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_region;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_city;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_commune;

-- ============================================================
-- 6. Verificacion final
-- ============================================================
DO $$
DECLARE
  v_total       INTEGER;
  v_country_ok  INTEGER;
  v_region_ok   INTEGER;
  v_city_ok     INTEGER;
  v_commune_ok  INTEGER;
  v_event_ok    INTEGER;
  v_status_ok   INTEGER;
  v_currency_ok INTEGER;
BEGIN
  SELECT count(*) INTO v_total       FROM claims;
  SELECT count(*) INTO v_country_ok  FROM claims WHERE country_id  IS NOT NULL;
  SELECT count(*) INTO v_region_ok   FROM claims WHERE region_id   IS NOT NULL;
  SELECT count(*) INTO v_city_ok     FROM claims WHERE city_id     IS NOT NULL;
  SELECT count(*) INTO v_commune_ok  FROM claims WHERE commune_id  IS NOT NULL;
  SELECT count(*) INTO v_event_ok    FROM claims WHERE event_id    IS NOT NULL;
  SELECT count(*) INTO v_status_ok   FROM claims WHERE status_id   IS NOT NULL;
  SELECT count(*) INTO v_currency_ok FROM claims WHERE currency_id IS NOT NULL;

  RAISE NOTICE 'Migracion 51 completada:';
  RAISE NOTICE '  Total claims:        %', v_total;
  RAISE NOTICE '  country_id:          %/%', v_country_ok, v_total;
  RAISE NOTICE '  region_id:           %/%', v_region_ok, v_total;
  RAISE NOTICE '  city_id:             %/%', v_city_ok, v_total;
  RAISE NOTICE '  commune_id:          %/%', v_commune_ok, v_total;
  RAISE NOTICE '  event_id:            %/%', v_event_ok, v_total;
  RAISE NOTICE '  status_id:           %/%', v_status_ok, v_total;
  RAISE NOTICE '  currency_id:         %/%', v_currency_ok, v_total;
END $$;
