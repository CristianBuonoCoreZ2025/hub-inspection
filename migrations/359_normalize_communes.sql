-- ============================================================
-- Hub Inspections — Migracion 359: Normalizar comunas en claims_participants
--
-- 1334 filas con comunas que no matchean el catálogo por case/acentos.
-- Actualiza commune al nombre exacto del catálogo communes.
-- ============================================================

UPDATE claims_participants cp
SET
  commune = co.name,
  updated_at = NOW()
FROM communes co
WHERE cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
  AND unaccent(lower(TRIM(cp.commune))) = unaccent(lower(TRIM(co.name)))
  AND cp.commune <> co.name;
