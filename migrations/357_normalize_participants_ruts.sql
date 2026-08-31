-- ============================================================
-- Hub Inspections — Migracion 357: Normalizar RUTs mal escritos en claims_participants
--
-- 11 filas con RUTs mal formateados:
--   - 7 con puntos (14.106.643-9 → 14106643-9)
--   - 4 sin guión ni DV (53160662 → 5316066-2, 98170618 → 9817061-8)
-- ============================================================

-- 1. Quitar puntos de los RUTs (mantener guión y DV)
UPDATE claims_participants
SET rut = REPLACE(rut, '.', ''),
    updated_at = NOW()
WHERE rut IS NOT NULL
  AND rut LIKE '%.%'
  AND rut LIKE '%-%';

-- 2. RUT "53160662" (sin guión ni DV) → "5316066-2"
--    Es el mismo Eduardo que tiene "5.316.066-2" (ya corregido a "5316066-2" en paso 1)
UPDATE claims_participants
SET rut = '5316066-2',
    updated_at = NOW()
WHERE rut = '53160662';

-- 3. RUT "98170618" (sin guión ni DV) → "9817061-8"
--    Gloria Sosa Titiro — el DV correcto es 8
UPDATE claims_participants
SET rut = '9817061-8',
    updated_at = NOW()
WHERE rut = '98170618';
