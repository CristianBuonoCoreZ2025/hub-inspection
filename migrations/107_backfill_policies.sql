-- ═══════════════════════════════════════════════════════════════
-- Migración 107: Backfill de pólizas para siniestros existentes
--
-- Crea pólizas para todos los siniestros que tienen policy_number
-- pero no tienen policy_id asignado.
--
-- También crea pólizas "pendientes" para siniestros sin policy_number.
-- ═══════════════════════════════════════════════════════════════

-- 1. Crear pólizas para siniestros con policy_number pero sin policy_id
INSERT INTO policies (policy_name, policy_number, policy_type, insurance_company_id, business_line_id, currency, premium_amount, insured_amount, start_date, end_date, status, company_id)
SELECT DISTINCT
  c.policy_number,
  c.policy_number,
  'individual',
  c.insurance_company_id,
  c.business_line_id,
  COALESCE((SELECT code FROM countries WHERE id = c.country_id LIMIT 1), 'CLP'),
  c.policy_premium,
  c.policy_amount,
  COALESCE(c.policy_start_date, CURRENT_DATE),
  COALESCE(c.policy_end_date, CURRENT_DATE + INTERVAL '1 year'),
  'active',
  c.company_id
FROM claims c
WHERE c.policy_number IS NOT NULL
  AND c.policy_number != ''
  AND c.policy_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM policies p WHERE p.policy_number = c.policy_number)
ON CONFLICT DO NOTHING;

-- 2. Actualizar claims.policy_id con las pólizas recién creadas
UPDATE claims c
SET policy_id = p.id
FROM policies p
WHERE c.policy_number = p.policy_number
  AND c.policy_id IS NULL;

-- 3. Para siniestros sin policy_number, crear una póliza "pendiente"
--    (una por siniestro, con status draft y sin número)
INSERT INTO policies (policy_name, policy_number, policy_type, insurance_company_id, business_line_id, currency, start_date, end_date, status, company_id)
SELECT
  'PÓLIZA PENDIENTE - ' || c.claim_number,
  NULL,
  'individual',
  c.insurance_company_id,
  c.business_line_id,
  'CLP',
  COALESCE(c.policy_start_date, CURRENT_DATE),
  COALESCE(c.policy_end_date, CURRENT_DATE + INTERVAL '1 year'),
  'draft',
  c.company_id
FROM claims c
WHERE (c.policy_number IS NULL OR c.policy_number = '')
  AND c.policy_id IS NULL;

-- 4. Asignar las pólizas pendientes a los siniestros sin número
UPDATE claims c
SET policy_id = p.id
FROM policies p
WHERE p.policy_name = 'PÓLIZA PENDIENTE - ' || c.claim_number
  AND p.policy_number IS NULL
  AND c.policy_id IS NULL
  AND (c.policy_number IS NULL OR c.policy_number = '');

-- 5. Verificación: cualquier siniestro que aún no tenga policy_id,
--    crearle una póliza pendiente genérica
INSERT INTO policies (policy_name, policy_number, policy_type, insurance_company_id, business_line_id, currency, start_date, end_date, status, company_id)
SELECT
  'PÓLIZA PENDIENTE - ' || c.claim_number,
  NULL,
  'individual',
  c.insurance_company_id,
  c.business_line_id,
  'CLP',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  'draft',
  c.company_id
FROM claims c
WHERE c.policy_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM policies p
    WHERE p.policy_name = 'PÓLIZA PENDIENTE - ' || c.claim_number
  );

UPDATE claims c
SET policy_id = p.id
FROM policies p
WHERE p.policy_name = 'PÓLIZA PENDIENTE - ' || c.claim_number
  AND p.policy_number IS NULL
  AND c.policy_id IS NULL;
