-- ============================================================
-- Hub Inspections — Migracion 356c: Fix filas que matchearon con Perú
--
-- La migracion 356 no filtro por pais, entonces 119 filas con
-- 12 comunas que existen tanto en Chile como en Perú matchearon
-- con Perú (Cajamarca, Puno, Piura, Ica, Apurimac, Lima).
-- Esta migracion las corrige usando solo el catalogo chileno.
-- ============================================================

-- Filtrar solo regiones de Chile
UPDATE claims_participants cp
SET
  city = c_city.name,
  region = r.name,
  updated_at = NOW()
FROM communes co
JOIN cities c_city ON c_city.id = co.city_id
JOIN regions r ON r.id = c_city.region_id
WHERE
  r.country_id = '9b8807b5-0af1-4331-b576-3b09b6a1db31'  -- Chile
  AND cp.commune IS NOT NULL
  AND TRIM(cp.commune) <> ''
  AND unaccent(lower(TRIM(cp.commune))) = unaccent(lower(TRIM(co.name)))
  AND NOT EXISTS (
    SELECT 1 FROM regions r2
    WHERE r2.name = cp.region AND r2.country_id = '9b8807b5-0af1-4331-b576-3b09b6a1db31'
  );
