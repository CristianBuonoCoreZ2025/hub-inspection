-- ============================================================
-- Hub Inspections — Migracion 29: Agregar country_id FK a catalogos
-- Todos los mantenedores deben referenciar countries(id)
-- ============================================================

-- 1. business_lines
ALTER TABLE business_lines ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
UPDATE business_lines SET country_id = (SELECT id FROM countries WHERE code = 'CL') WHERE country_id IS NULL;

-- 2. insurance_products
ALTER TABLE insurance_products ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
UPDATE insurance_products SET country_id = (SELECT id FROM countries WHERE code = 'CL') WHERE country_id IS NULL;

-- 3. claim_causes
ALTER TABLE claim_causes ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
UPDATE claim_causes SET country_id = (SELECT id FROM countries WHERE code = 'CL') WHERE country_id IS NULL;

-- 4. brokers
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
UPDATE brokers SET country_id = (SELECT id FROM countries WHERE code = 'CL') WHERE country_id IS NULL;

-- 5. advisors
ALTER TABLE advisors ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
UPDATE advisors SET country_id = (SELECT id FROM countries WHERE code = 'CL') WHERE country_id IS NULL;

-- 6. insurance_companies
ALTER TABLE insurance_companies ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
UPDATE insurance_companies SET country_id = (SELECT id FROM countries WHERE code = 'CL') WHERE country_id IS NULL;
