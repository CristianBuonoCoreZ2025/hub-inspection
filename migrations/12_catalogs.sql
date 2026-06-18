-- ============================================================
-- Hub Inspections — Migracion 12: Catalogos Maestros
-- ============================================================

-- 1. CAUSAS DE SINIESTRO
CREATE TABLE IF NOT EXISTS claim_causes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  country TEXT NOT NULL DEFAULT 'CL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE claim_causes IS 'Causas de siniestro (mantenedor de catalogos)';

-- 2. COMPANIAS DE SEGUROS
CREATE TABLE IF NOT EXISTS insurance_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rut TEXT,
  address TEXT,
  line_of_business TEXT,
  code TEXT,
  type TEXT DEFAULT 'Generales',
  country TEXT NOT NULL DEFAULT 'CL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE insurance_companies IS 'Companias de seguros (mantenedor de catalogos)';

-- 3. CORREDORES
CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rut TEXT,
  address TEXT,
  contact TEXT,
  country TEXT NOT NULL DEFAULT 'CL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE brokers IS 'Corredores de seguros (mantenedor de catalogos)';

-- 4. LINEAS DE NEGOCIO
CREATE TABLE IF NOT EXISTS business_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country TEXT NOT NULL DEFAULT 'CL',
  name TEXT NOT NULL,
  claim_type TEXT,
  ramo_fecu TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE business_lines IS 'Lineas de negocio / ramos (mantenedor de catalogos)';

-- 5. RAMOS/PRODUCTOS
CREATE TABLE IF NOT EXISTS insurance_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_line_id UUID NOT NULL REFERENCES business_lines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  country TEXT NOT NULL DEFAULT 'CL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE insurance_products IS 'Productos/Ramos dentro de una linea de negocio';

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS claim_causes_updated_at ON claim_causes;
CREATE TRIGGER claim_causes_updated_at BEFORE UPDATE ON claim_causes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS insurance_companies_updated_at ON insurance_companies;
CREATE TRIGGER insurance_companies_updated_at BEFORE UPDATE ON insurance_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS brokers_updated_at ON brokers;
CREATE TRIGGER brokers_updated_at BEFORE UPDATE ON brokers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS business_lines_updated_at ON business_lines;
CREATE TRIGGER business_lines_updated_at BEFORE UPDATE ON business_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS insurance_products_updated_at ON insurance_products;
CREATE TRIGGER insurance_products_updated_at BEFORE UPDATE ON insurance_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
