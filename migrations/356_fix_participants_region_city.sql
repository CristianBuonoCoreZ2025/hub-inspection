-- ============================================================
-- Hub Inspections — Migracion 356: Fix region y city en claims_participants
--
-- Hubo un update malo que cargo incorrectamente city y region.
-- Esta migracion reconstruye city y region a partir del commune
-- usando la jerarquia: communes → cities → regions.
--
-- Solo actualiza filas donde commune no es vacio/null.
-- Matching: case-insensitive, sin acentos (unaccent).
-- ============================================================

-- 1. Asegurar que unaccent este disponible
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Sin comuna → city y region a NULL
UPDATE claims_participants
SET
  city = NULL,
  region = NULL,
  updated_at = NOW()
WHERE
  commune IS NULL
  OR TRIM(commune) = '';

-- 3. Actualizar city desde la jerarquia commune → city
UPDATE claims_participants cp
SET
  city = c_city.name,
  updated_at = NOW()
FROM communes co
JOIN cities c_city ON c_city.id = co.city_id
WHERE
  cp.commune IS NOT NULL
  AND TRIM(cp.commune) <> ''
  AND unaccent(lower(TRIM(cp.commune))) = unaccent(lower(TRIM(co.name)))
  AND (
    cp.city IS NULL
    OR TRIM(cp.city) = ''
    OR unaccent(lower(TRIM(cp.city))) <> unaccent(lower(TRIM(c_city.name)))
  );

-- 4. Actualizar region desde la jerarquia commune → city → region
UPDATE claims_participants cp
SET
  region = r.name,
  updated_at = NOW()
FROM communes co
JOIN cities c_city ON c_city.id = co.city_id
JOIN regions r ON r.id = c_city.region_id
WHERE
  cp.commune IS NOT NULL
  AND TRIM(cp.commune) <> ''
  AND unaccent(lower(TRIM(cp.commune))) = unaccent(lower(TRIM(co.name)))
  AND (
    cp.region IS NULL
    OR TRIM(cp.region) = ''
    OR unaccent(lower(TRIM(cp.region))) <> unaccent(lower(TRIM(r.name)))
  );

-- 5. Reporte: cuantas filas quedaron sin city/region a pesar de tener commune
-- (comuna no encontrada en el catalogo). Solo informativo, no falla.
SELECT
  count(*) AS sin_resolver,
  count(DISTINCT cp.commune) AS comunas_no_encontradas
FROM claims_participants cp
WHERE
  cp.commune IS NOT NULL
  AND TRIM(cp.commune) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM communes co
    WHERE unaccent(lower(TRIM(cp.commune))) = unaccent(lower(TRIM(co.name)))
  );
