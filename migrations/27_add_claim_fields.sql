-- ============================================================
-- Hub Inspections — Migracion 27: Agregar campos faltantes de claims
-- Datos del contratante, beneficiario, detalle del siniestro, póliza, etc.
-- ============================================================

-- Ejecutivo Cia
ALTER TABLE claims ADD COLUMN IF NOT EXISTS executive_name TEXT;

-- Fechas
ALTER TABLE claims ADD COLUMN IF NOT EXISTS created_date DATE;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS closed_date DATE;

-- Evento
ALTER TABLE claims ADD COLUMN IF NOT EXISTS event TEXT;

-- Datos de la póliza
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_item TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_start_date DATE;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_end_date DATE;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_currency TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_amount NUMERIC(15,2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_premium NUMERIC(15,2);

-- Datos del contratante
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_rut TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_name TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_last_name TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_email TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_phone TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_cell_phone TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_address TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_country TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_region TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_city TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_commune TEXT;

-- Datos del beneficiario
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_rut TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_name TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_last_name TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_email TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_phone TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_cell_phone TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_address TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_country TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_region TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_city TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_commune TEXT;

-- Dirección del siniestro (puede ser diferente a la del asegurado)
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_address TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_country TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_region TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_city TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_commune TEXT;

-- Contacto
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Detalle del inmueble / daño
ALTER TABLE claims ADD COLUMN IF NOT EXISTS construction_type TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS damage_classification TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS is_habitable BOOLEAN;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS owner_same_as_insured BOOLEAN;
