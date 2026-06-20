-- ============================================================
-- Hub Inspections — Migracion 38: Eliminar FKs de contacts en claims
-- Los participantes ahora viven en claim_participants con claim_id
-- ============================================================

-- Eliminar columnas FK a contacts (reemplazadas por claim_participants)
ALTER TABLE claims DROP COLUMN IF EXISTS insured_id;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_id;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_id;
ALTER TABLE claims DROP COLUMN IF EXISTS executive_id;
ALTER TABLE claims DROP COLUMN IF EXISTS general_contact_id;

-- Eliminar tabla contacts (datos ya migrados a claim_participants)
DROP TABLE IF EXISTS contacts CASCADE;
