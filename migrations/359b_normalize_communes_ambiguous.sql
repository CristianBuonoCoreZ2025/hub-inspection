-- ============================================================
-- Hub Inspections — Migracion 359b: Fix comunas restantes con match ambiguo
--
-- 12 comunas que no se actualizaron porque hay múltiples versiones
-- en el catálogo (con/sin acentos, Chile/Perú).
-- Filtra solo Chile y prefiere la versión con acentos.
-- ============================================================

UPDATE claims_participants cp
SET
  commune = co.name,
  updated_at = NOW()
FROM communes co
JOIN cities c ON c.id = co.city_id
JOIN regions r ON r.id = c.region_id
WHERE r.country_id = '9b8807b5-0af1-4331-b576-3b09b6a1db31'  -- Chile
  AND cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
  AND unaccent(lower(TRIM(cp.commune))) = unaccent(lower(TRIM(co.name)))
  AND cp.commune <> co.name
  -- Preferir la versión con acentos (la que tiene más caracteres especiales)
  AND co.id = (
    SELECT co2.id FROM communes co2
    JOIN cities c2 ON c2.id = co2.city_id
    JOIN regions r2 ON r2.id = c2.region_id
    WHERE r2.country_id = '9b8807b5-0af1-4331-b576-3b09b6a1db31'
      AND unaccent(lower(TRIM(co2.name))) = unaccent(lower(TRIM(cp.commune)))
    ORDER BY length(co2.name) DESC, co2.name
    LIMIT 1
  );
