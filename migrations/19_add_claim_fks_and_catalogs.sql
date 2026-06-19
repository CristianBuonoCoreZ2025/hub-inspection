-- ============================================================
-- Hub Inspections — Migracion 19: FKs en claims + catalogos faltantes
-- Agrega columnas FK a claims y crea registros faltantes en catalogos
-- ============================================================

-- 1. Agregar columnas FK a claims
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES insurance_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advisor_id UUID REFERENCES advisors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_cause_id UUID REFERENCES claim_causes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_type_id UUID REFERENCES claim_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_line_id UUID REFERENCES business_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_product_id UUID REFERENCES insurance_products(id) ON DELETE SET NULL;

-- 2. Crear companias de seguros faltantes
INSERT INTO insurance_companies (id, name, country, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'HDI Seguros', 'CL', true),
  ('22222222-2222-2222-2222-222222222222', 'Zurich Santander', 'CL', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3. Crear lineas de negocio faltantes
INSERT INTO business_lines (id, country, name, is_active)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'CL', 'Comercial', true),
  ('44444444-4444-4444-4444-444444444444', 'CL', 'Hogar', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 4. Crear tipo de siniestro faltante
INSERT INTO claim_types (id, name, is_active)
VALUES ('55555555-5555-5555-5555-555555555555', 'Property', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 5. Crear causas de siniestro faltantes
INSERT INTO claim_causes (id, name, country, is_active)
VALUES
  ('66666666-6666-6666-6666-666666666666', 'Avería de maquinaria', 'CL', true),
  ('77777777-7777-7777-7777-777777777777', 'Daños Eléctricos', 'CL', true),
  ('88888888-8888-8888-8888-888888888888', 'Daños maliciosos', 'CL', true),
  ('99999999-9999-9999-9999-999999999999', 'Daños por Vehículos', 'CL', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Filtración de aguas lluvias', 'CL', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Inundación', 'CL', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Rotura de cañerías', 'CL', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
