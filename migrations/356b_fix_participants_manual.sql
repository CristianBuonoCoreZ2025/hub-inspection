-- ============================================================
-- Hub Inspections — Migracion 356b: Fix manual de comunas no encontradas
--
-- La migracion 356 uso matching exacto (unaccent + lower) y resolvio
-- 4168 filas correctamente. Quedaron 17 filas con 6 comunas que no
-- coincidian exactamente con el catalogo. Esta migracion las corrige
-- manualmente.
-- ============================================================

-- 1. "SIN COMUNA" → no es una comuna real, poner city y region a NULL
UPDATE claims_participants
SET city = NULL, region = NULL, updated_at = NOW()
WHERE commune = 'SIN COMUNA';

-- 2. "CON-CON" y "CON CON" → "Concón" en Valparaíso, V Región
UPDATE claims_participants
SET city = 'Valparaíso', region = 'V Región', updated_at = NOW()
WHERE commune IN ('CON-CON', 'CON CON');

-- 3. "LLAILLAY" → "Llay Llay" en San Felipe, V Región
UPDATE claims_participants
SET city = 'San Felipe', region = 'V Región', updated_at = NOW()
WHERE commune = 'LLAILLAY';

-- 4. "Rinconada de Los Andes" → "Rinconada" en Los Andes, V Región
UPDATE claims_participants
SET city = 'Los Andes', region = 'V Región', updated_at = NOW()
WHERE commune = 'Rinconada de Los Andes';

-- 5. "Tarapacá" como comuna → es nombre de region, no comuna.
--    La comuna mas probable es Iquique (capital de I Región/Tarapacá).
--    Pero es ambiguo — dejar city y region a NULL para revision manual.
UPDATE claims_participants
SET city = NULL, region = NULL, updated_at = NOW()
WHERE commune = 'Tarapacá';
