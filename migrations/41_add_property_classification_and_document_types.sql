-- ============================================================
-- Hub Inspections -- Migracion 41: Agregar property_classification_id a claims y document types a lookup_catalog
-- ============================================================

-- 1. Agregar FK a property_classifications en claims
ALTER TABLE claims
ADD COLUMN IF NOT EXISTS property_classification_id UUID REFERENCES property_classifications(id) ON DELETE SET NULL;

-- 2. Agregar tipos de documento a lookup_catalog (si no existen)
INSERT INTO lookup_catalog (country_id, category, code, name, is_active) VALUES
  ((SELECT id FROM countries WHERE code = 'CL'), 'document_type', 'informe', 'Informe', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'document_type', 'foto', 'Fotografía', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'document_type', 'poliza', 'Póliza', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'document_type', 'denuncio', 'Denuncio', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'document_type', 'cotizacion', 'Cotización', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'document_type', 'factura', 'Factura', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'document_type', 'otro', 'Otro', true)
ON CONFLICT DO NOTHING;
