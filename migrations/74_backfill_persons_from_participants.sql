-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 74: Backfill persons desde claims_participants
-- Carga personas existentes (insured, contractor, beneficiary)
-- con su país + tax_id (RUT) y sus direcciones históricas.
-- ═══════════════════════════════════════════════════════════════

-- 1. Insertar personas únicas desde claims_participants
--    (solo insured, contractor, beneficiary con RUT no vacío)
--    Usamos DISTINCT ON para evitar duplicados del mismo (country_id, tax_id)
INSERT INTO persons (country_id, tax_id, first_name, last_name, created_at)
SELECT DISTINCT ON (c.id, UPPER(REPLACE(REPLACE(REPLACE(cp.rut, '.', ''), '-', ''), ' ', '')))
  c.id,
  UPPER(REPLACE(REPLACE(REPLACE(cp.rut, '.', ''), '-', ''), ' ', '')),
  cp.first_name,
  NULLIF(cp.last_name, ''),
  COALESCE(cp.created_at, now())
FROM claims_participants cp
JOIN countries c ON c.name = cp.country
WHERE cp.rut IS NOT NULL
  AND cp.rut != ''
  AND cp.country IS NOT NULL
  AND cp.country != ''
  AND cp.first_name IS NOT NULL
  AND cp.first_name != ''
  AND cp.type IN ('insured', 'contractor', 'beneficiary')
ORDER BY
  c.id,
  UPPER(REPLACE(REPLACE(REPLACE(cp.rut, '.', ''), '-', ''), ' ', '')),
  cp.created_at DESC
ON CONFLICT (country_id, tax_id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), persons.last_name),
  updated_at = now();

-- 2. Insertar direcciones desde claims_participants
--    Una dirección por cada participante con RUT (evita duplicados)
INSERT INTO person_addresses (person_id, address, country, region, city, commune, source_claim_id, created_at)
SELECT DISTINCT
  p.id,
  cp.address,
  cp.country,
  cp.region,
  cp.city,
  cp.commune,
  cp.claim_id,
  COALESCE(cp.created_at, now())
FROM claims_participants cp
JOIN countries c ON c.name = cp.country
JOIN persons p ON p.country_id = c.id
  AND UPPER(REPLACE(REPLACE(REPLACE(cp.rut, '.', ''), '-', ''), ' ', '')) = p.tax_id
WHERE cp.rut IS NOT NULL
  AND cp.rut != ''
  AND cp.country IS NOT NULL
  AND cp.country != ''
  AND cp.type IN ('insured', 'contractor', 'beneficiary')
  AND (
    cp.address IS NOT NULL AND cp.address != ''
    OR cp.city IS NOT NULL AND cp.city != ''
  )
ON CONFLICT DO NOTHING;
