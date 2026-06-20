-- ============================================================
-- Hub Inspections — Migracion 35: Eliminar columnas duplicadas de claims
-- Los datos ahora viven en contacts y lookup_catalog
-- ============================================================

-- Datos del asegurado → contacts (insured_id)
ALTER TABLE claims DROP COLUMN IF EXISTS insured_name;
ALTER TABLE claims DROP COLUMN IF EXISTS last_name;
ALTER TABLE claims DROP COLUMN IF EXISTS rut;
ALTER TABLE claims DROP COLUMN IF EXISTS insured_email;
ALTER TABLE claims DROP COLUMN IF EXISTS insured_phone;
ALTER TABLE claims DROP COLUMN IF EXISTS cell_phone;
ALTER TABLE claims DROP COLUMN IF EXISTS address;
ALTER TABLE claims DROP COLUMN IF EXISTS country;
ALTER TABLE claims DROP COLUMN IF EXISTS region;
ALTER TABLE claims DROP COLUMN IF EXISTS city;
ALTER TABLE claims DROP COLUMN IF EXISTS commune;

-- Datos del contratante → contacts (contractor_id)
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_rut;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_name;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_last_name;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_email;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_phone;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_cell_phone;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_address;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_country;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_region;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_city;
ALTER TABLE claims DROP COLUMN IF EXISTS contractor_commune;

-- Datos del beneficiario → contacts (beneficiary_id)
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_rut;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_name;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_last_name;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_email;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_phone;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_cell_phone;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_address;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_country;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_region;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_city;
ALTER TABLE claims DROP COLUMN IF EXISTS beneficiary_commune;

-- Ejecutivo → contacts (executive_id)
ALTER TABLE claims DROP COLUMN IF EXISTS executive_name;

-- Contacto general → contacts (general_contact_id)
ALTER TABLE claims DROP COLUMN IF EXISTS contact_name;
ALTER TABLE claims DROP COLUMN IF EXISTS contact_role;
ALTER TABLE claims DROP COLUMN IF EXISTS contact_email;
ALTER TABLE claims DROP COLUMN IF EXISTS contact_phone;

-- Catalogos → lookup_catalog
ALTER TABLE claims DROP COLUMN IF EXISTS construction_type;
ALTER TABLE claims DROP COLUMN IF EXISTS destination;
ALTER TABLE claims DROP COLUMN IF EXISTS damage_classification;
ALTER TABLE claims DROP COLUMN IF EXISTS is_habitable;

-- Redundantes (ya tenemos FKs)
ALTER TABLE claims DROP COLUMN IF EXISTS insurance_company;
ALTER TABLE claims DROP COLUMN IF EXISTS broker_name;
ALTER TABLE claims DROP COLUMN IF EXISTS broker_number;
ALTER TABLE claims DROP COLUMN IF EXISTS builder_name;
ALTER TABLE claims DROP COLUMN IF EXISTS advisor;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_cause;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_type;
ALTER TABLE claims DROP COLUMN IF EXISTS business_line;

-- Fechas duplicadas (ya tenemos claim_date, report_date, assignment_date)
ALTER TABLE claims DROP COLUMN IF EXISTS created_date;
ALTER TABLE claims DROP COLUMN IF EXISTS closed_date;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_time;

-- Direccion del siniestro (mantener claim_address, claim_country, etc. por ahora)
-- ALTER TABLE claims DROP COLUMN IF EXISTS claim_address;
-- ALTER TABLE claims DROP COLUMN IF EXISTS claim_country;
-- ALTER TABLE claims DROP COLUMN IF EXISTS claim_region;
-- ALTER TABLE claims DROP COLUMN IF EXISTS claim_city;
-- ALTER TABLE claims DROP COLUMN IF EXISTS claim_commune;
