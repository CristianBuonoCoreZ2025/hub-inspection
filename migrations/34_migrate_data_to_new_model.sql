-- ============================================================
-- Hub Inspections — Migracion 34: Migrar datos a nuevo modelo
-- Crea contacts desde claims y mapea lookup_catalog (todo en SQL)
-- ============================================================

DO $$
DECLARE
  v_chile_id UUID;
  v_mclarens_id UUID;
  r RECORD;
  v_id UUID;
BEGIN
  SELECT id INTO v_chile_id FROM countries WHERE code = 'CL';
  SELECT id INTO v_mclarens_id FROM companies WHERE slug = 'mclarens';

  -- 1. Crear contacts para asegurados faltantes
  FOR r IN
    SELECT id as claim_id, claim_number, insured_name, last_name, rut, insured_email, insured_phone, cell_phone,
      address, country, region, city, commune
    FROM claims
    WHERE insured_id IS NULL AND insured_name IS NOT NULL
  LOOP
    v_id := md5('insured-' || r.claim_number)::uuid;
    INSERT INTO contacts (id, company_id, country_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune)
    VALUES (v_id, v_mclarens_id, v_chile_id, 'insured',
      COALESCE(r.insured_name, '') || COALESCE(' ' || r.last_name, ''), r.insured_name, r.last_name, r.rut, r.insured_email, r.insured_phone, r.cell_phone, r.address, r.country, r.region, r.city, r.commune)
    ON CONFLICT (id) DO NOTHING;
    UPDATE claims SET insured_id = v_id WHERE id = r.claim_id;
  END LOOP;

  -- 2. Crear contacts para contratantes
  FOR r IN
    SELECT id as claim_id, claim_number, contractor_name, contractor_last_name, contractor_rut, contractor_email, contractor_phone, contractor_cell_phone,
      contractor_address, contractor_country, contractor_region, contractor_city, contractor_commune
    FROM claims
    WHERE contractor_id IS NULL AND contractor_name IS NOT NULL
  LOOP
    v_id := md5('contractor-' || r.claim_number)::uuid;
    INSERT INTO contacts (id, company_id, country_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune)
    VALUES (v_id, v_mclarens_id, v_chile_id, 'contractor',
      COALESCE(r.contractor_name, '') || COALESCE(' ' || r.contractor_last_name, ''), r.contractor_name, r.contractor_last_name, r.contractor_rut, r.contractor_email, r.contractor_phone, r.contractor_cell_phone, r.contractor_address, r.contractor_country, r.contractor_region, r.contractor_city, r.contractor_commune)
    ON CONFLICT (id) DO NOTHING;
    UPDATE claims SET contractor_id = v_id WHERE id = r.claim_id;
  END LOOP;

  -- 3. Crear contacts para beneficiarios
  FOR r IN
    SELECT id as claim_id, claim_number, beneficiary_name, beneficiary_last_name, beneficiary_rut, beneficiary_email, beneficiary_phone, beneficiary_cell_phone,
      beneficiary_address, beneficiary_country, beneficiary_region, beneficiary_city, beneficiary_commune
    FROM claims
    WHERE beneficiary_id IS NULL AND beneficiary_name IS NOT NULL
  LOOP
    v_id := md5('beneficiary-' || r.claim_number)::uuid;
    INSERT INTO contacts (id, company_id, country_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune)
    VALUES (v_id, v_mclarens_id, v_chile_id, 'beneficiary',
      COALESCE(r.beneficiary_name, '') || COALESCE(' ' || r.beneficiary_last_name, ''), r.beneficiary_name, r.beneficiary_last_name, r.beneficiary_rut, r.beneficiary_email, r.beneficiary_phone, r.beneficiary_cell_phone, r.beneficiary_address, r.beneficiary_country, r.beneficiary_region, r.beneficiary_city, r.beneficiary_commune)
    ON CONFLICT (id) DO NOTHING;
    UPDATE claims SET beneficiary_id = v_id WHERE id = r.claim_id;
  END LOOP;

  -- 4. Crear contacts para ejecutivos
  FOR r IN
    SELECT id as claim_id, claim_number, executive_name
    FROM claims
    WHERE executive_id IS NULL AND executive_name IS NOT NULL
  LOOP
    v_id := md5('executive-' || r.claim_number)::uuid;
    INSERT INTO contacts (id, company_id, country_id, type, full_name, first_name, last_name)
    VALUES (v_id, v_mclarens_id, v_chile_id, 'executive', r.executive_name, split_part(r.executive_name, ' ', 1), trim(substring(r.executive_name from strpos(r.executive_name, ' ') + 1)))
    ON CONFLICT (id) DO NOTHING;
    UPDATE claims SET executive_id = v_id WHERE id = r.claim_id;
  END LOOP;

  -- 5. Crear contacts para contactos generales
  FOR r IN
    SELECT id as claim_id, claim_number, contact_name, contact_email, contact_phone
    FROM claims
    WHERE general_contact_id IS NULL AND contact_name IS NOT NULL
  LOOP
    v_id := md5('contact-' || r.claim_number)::uuid;
    INSERT INTO contacts (id, company_id, country_id, type, full_name, first_name, last_name, email, phone)
    VALUES (v_id, v_mclarens_id, v_chile_id, 'contact', r.contact_name, split_part(r.contact_name, ' ', 1), trim(substring(r.contact_name from strpos(r.contact_name, ' ') + 1)), r.contact_email, r.contact_phone)
    ON CONFLICT (id) DO NOTHING;
    UPDATE claims SET general_contact_id = v_id WHERE id = r.claim_id;
  END LOOP;
END $$;

-- 6. Mapear lookup_catalog
UPDATE claims c
SET construction_type_id = l.id
FROM lookup_catalog l
WHERE l.category = 'construction_type' AND l.country_id = (SELECT id FROM countries WHERE code = 'CL')
  AND c.construction_type = l.name AND c.construction_type_id IS NULL;

UPDATE claims c
SET destination_housing_id = l.id
FROM lookup_catalog l
WHERE l.category = 'housing_destination' AND l.country_id = (SELECT id FROM countries WHERE code = 'CL')
  AND c.destination = l.name AND c.destination_housing_id IS NULL;

UPDATE claims c
SET damage_classification_id = l.id
FROM lookup_catalog l
WHERE l.category = 'damage_classification' AND l.country_id = (SELECT id FROM countries WHERE code = 'CL')
  AND c.damage_classification = l.name AND c.damage_classification_id IS NULL;

UPDATE claims c
SET habitability_id = l.id
FROM lookup_catalog l
WHERE l.category = 'habitability' AND l.country_id = (SELECT id FROM countries WHERE code = 'CL')
  AND ((c.is_habitable = true AND l.code = 'yes') OR (c.is_habitable = false AND l.code = 'no'))
  AND c.habitability_id IS NULL;
