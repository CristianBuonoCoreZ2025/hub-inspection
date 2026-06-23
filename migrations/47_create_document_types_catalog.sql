-- ============================================================
-- Hub Inspections -- Migracion 47: Crear catálogo de Tipos de Documentos por país
-- ============================================================

CREATE TABLE IF NOT EXISTS document_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE document_types IS 'Catálogo de tipos de documentos por país para siniestros';

CREATE INDEX IF NOT EXISTS idx_document_types_country ON document_types(country_id);
CREATE INDEX IF NOT EXISTS idx_document_types_active ON document_types(is_active);

DROP TRIGGER IF EXISTS document_types_updated_at ON document_types;
CREATE TRIGGER document_types_updated_at BEFORE UPDATE ON document_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed de tipos de documentos comunes para Chile
INSERT INTO document_types (country_id, code, name, is_active) VALUES
  ((SELECT id FROM countries WHERE code = 'CL'), 'informe', 'Informe', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'foto', 'Fotografía', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'poliza', 'Póliza', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'denuncio', 'Denuncio', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'cotizacion', 'Cotización', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'factura', 'Factura', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'acta', 'Acta de Inspección', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'croquis', 'Croquis', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'cedula', 'Cédula de Identidad', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'otro', 'Otro', true)
ON CONFLICT DO NOTHING;
