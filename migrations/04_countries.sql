-- ============================================================
-- Tabla de países (Sudamérica) + country_id en companies
-- Ejecutar en Hasura Console → Data → SQL
-- ============================================================

-- 1. Tabla countries
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code CHAR(2) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone_prefix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE countries IS 'Países disponibles para empresas';

-- 2. Seed países de Sudamérica
INSERT INTO countries (code, name, phone_prefix) VALUES
  ('AR', 'Argentina', '+54'),
  ('BO', 'Bolivia', '+591'),
  ('BR', 'Brasil', '+55'),
  ('CL', 'Chile', '+56'),
  ('CO', 'Colombia', '+57'),
  ('EC', 'Ecuador', '+593'),
  ('GY', 'Guyana', '+592'),
  ('PY', 'Paraguay', '+595'),
  ('PE', 'Perú', '+51'),
  ('SR', 'Surinam', '+597'),
  ('UY', 'Uruguay', '+598'),
  ('VE', 'Venezuela', '+58')
ON CONFLICT (code) DO NOTHING;

-- 3. Agregar country_id a companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
