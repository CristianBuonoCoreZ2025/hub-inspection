-- ============================================================
-- Hub Inspections — Migracion 356e: Fix Santiago con city/region null
--
-- 90 filas ya tenian commune="Santiago" pero city/region eran
-- null o "null" (string). Se setean correctamente.
-- ============================================================

UPDATE claims_participants
SET
  city = 'Santiago',
  region = 'Región Metropolitana',
  updated_at = NOW()
WHERE
  commune = 'Santiago'
  AND (
    city IS NULL
    OR TRIM(city) = ''
    OR lower(TRIM(city)) = 'null'
  )
  AND (
    region IS NULL
    OR TRIM(region) = ''
    OR lower(TRIM(region)) = 'null'
  );
