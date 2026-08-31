-- ============================================================
-- Hub Inspections — Migracion 356d: Comuna NULL → Santiago
--
-- Las filas con comuna vacia se setean a Santiago (capital),
-- con city=Santiago y region=Región Metropolitana.
-- ============================================================

UPDATE claims_participants
SET
  commune = 'Santiago',
  city = 'Santiago',
  region = 'Región Metropolitana',
  updated_at = NOW()
WHERE
  commune IS NULL
  OR TRIM(commune) = '';
