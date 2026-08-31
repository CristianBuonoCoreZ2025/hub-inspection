-- ============================================================
-- Hub Inspections — Migracion 356f: Fix últimas 5 filas
-- ============================================================

-- 1. "Penco" → comuna real de Chile: Concepción, VIII Región
UPDATE claims_participants
SET city = 'Concepción', region = 'VIII Región', updated_at = NOW()
WHERE commune = 'Penco'
  AND (city IS NULL OR TRIM(city) = '' OR lower(TRIM(city)) = 'null');

-- 2. "SIN COMUNA" y "Tarapacá" → Santiago
UPDATE claims_participants
SET commune = 'Santiago', city = 'Santiago', region = 'Región Metropolitana', updated_at = NOW()
WHERE commune IN ('SIN COMUNA', 'Tarapacá');
