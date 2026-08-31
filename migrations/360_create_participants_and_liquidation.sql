-- ============================================================
-- Hub Inspections — Migracion 360: Crear participantes y pasar a liquidación
--
-- Para los 126 claims en "created":
-- 1. Crear beneficiary, contractor y contact copiando datos del insured
-- 2. Cambiar status a "adjustment" (liquidación)
--    → el trigger trg_execute_workflow crea las gestiones automáticamente
-- ============================================================

-- 1. Crear beneficiary copiando del insured (solo si no existe ya)
INSERT INTO claims_participants (
  claim_id, type, full_name, first_name, last_name, rut, email,
  phone, cell_phone, address, country, region, city, commune,
  latitude, longitude, notes, is_active, linked_to_insured, person_type
)
SELECT
  cp.claim_id, 'beneficiary', cp.full_name, cp.first_name, cp.last_name,
  cp.rut, cp.email, cp.phone, cp.cell_phone, cp.address,
  cp.country, cp.region, cp.city, cp.commune,
  cp.latitude, cp.longitude, cp.notes, true, true, cp.person_type
FROM claims_participants cp
JOIN claims c ON c.id = cp.claim_id
JOIN lookup_catalog cs ON cs.id = c.status_id
WHERE cs.code = 'created' AND cp.type = 'insured'
  AND NOT EXISTS (
    SELECT 1 FROM claims_participants cp2
    WHERE cp2.claim_id = cp.claim_id AND cp2.type = 'beneficiary'
  );

-- 2. Crear contractor copiando del insured (solo si no existe ya)
INSERT INTO claims_participants (
  claim_id, type, full_name, first_name, last_name, rut, email,
  phone, cell_phone, address, country, region, city, commune,
  latitude, longitude, notes, is_active, linked_to_insured, person_type
)
SELECT
  cp.claim_id, 'contractor', cp.full_name, cp.first_name, cp.last_name,
  cp.rut, cp.email, cp.phone, cp.cell_phone, cp.address,
  cp.country, cp.region, cp.city, cp.commune,
  cp.latitude, cp.longitude, cp.notes, true, true, cp.person_type
FROM claims_participants cp
JOIN claims c ON c.id = cp.claim_id
JOIN lookup_catalog cs ON cs.id = c.status_id
WHERE cs.code = 'created' AND cp.type = 'insured'
  AND NOT EXISTS (
    SELECT 1 FROM claims_participants cp2
    WHERE cp2.claim_id = cp.claim_id AND cp2.type = 'contractor'
  );

-- 3. Crear contact copiando del insured (solo si no existe ya)
INSERT INTO claims_participants (
  claim_id, type, full_name, first_name, last_name, rut, email,
  phone, cell_phone, address, country, region, city, commune,
  latitude, longitude, notes, is_active, linked_to_insured, person_type
)
SELECT
  cp.claim_id, 'contact', cp.full_name, cp.first_name, cp.last_name,
  cp.rut, cp.email, cp.phone, cp.cell_phone, cp.address,
  cp.country, cp.region, cp.city, cp.commune,
  cp.latitude, cp.longitude, cp.notes, true, true, cp.person_type
FROM claims_participants cp
JOIN claims c ON c.id = cp.claim_id
JOIN lookup_catalog cs ON cs.id = c.status_id
WHERE cs.code = 'created' AND cp.type = 'insured'
  AND NOT EXISTS (
    SELECT 1 FROM claims_participants cp2
    WHERE cp2.claim_id = cp.claim_id AND cp2.type = 'contact'
  );

-- 4. Cambiar status a adjustment (liquidación)
--    El trigger trg_execute_workflow crea las gestiones del workflow automáticamente
UPDATE claims c
SET
  status_id = '10088b7e-6f51-4c84-8cdd-42c64b2140af',
  updated_at = NOW()
FROM lookup_catalog cs
WHERE cs.id = c.status_id AND cs.code = 'created';
