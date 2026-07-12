-- Migration 141: Agregar is_active a tablas de catalogo que no lo tienen

-- countries: tabla principal de paises
ALTER TABLE countries ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- characteristic_screens: pantallas de caracteristicas
ALTER TABLE characteristic_screens ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- property_materiality: materialidad de propiedades
ALTER TABLE property_materiality ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- property_risk: riesgo de propiedades
ALTER TABLE property_risk ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- security_measures: medidas de seguridad
ALTER TABLE security_measures ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- third_parties: terceros
ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- RLS para countries (si no la tiene)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'countries' AND relrowsecurity = true) THEN
    ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE countries FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "countries_all" ON countries;
CREATE POLICY "countries_all" ON countries
  FOR ALL TO public USING (true) WITH CHECK (true);
