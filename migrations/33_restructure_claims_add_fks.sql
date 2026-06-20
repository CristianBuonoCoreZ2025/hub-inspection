-- ============================================================
-- Hub Inspections — Migracion 33: Restructurar claims (Parte 1)
-- Agregar columnas FK a contacts y lookup_catalog
-- ============================================================

-- 1. Agregar FKs a contacts
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insured_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS beneficiary_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS executive_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS general_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- 2. Agregar FKs a lookup_catalog
ALTER TABLE claims ADD COLUMN IF NOT EXISTS construction_type_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS destination_housing_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS damage_classification_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS habitability_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS type_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS currency_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS billing_type_id UUID REFERENCES lookup_catalog(id) ON DELETE SET NULL;

-- 3. Index para las nuevas FKs
CREATE INDEX IF NOT EXISTS idx_claims_insured ON claims(insured_id);
CREATE INDEX IF NOT EXISTS idx_claims_contractor ON claims(contractor_id);
CREATE INDEX IF NOT EXISTS idx_claims_beneficiary ON claims(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_claims_construction_type ON claims(construction_type_id);
CREATE INDEX IF NOT EXISTS idx_claims_destination ON claims(destination_housing_id);
CREATE INDEX IF NOT EXISTS idx_claims_damage_class ON claims(damage_classification_id);
