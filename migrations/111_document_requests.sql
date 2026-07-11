-- ═══════════════════════════════════════════════════════════════
-- Migración 111: Sistema de Solicitud y Recepción de Documentos
--
-- Flujo:
-- 1. Solicitud de Documentos: el liquidador selecciona qué documentos
--    solicitar de los disponibles para la línea de negocio (solo los
--    que no se han recibido aún).
-- 2. Recepción de Documentos: se genera después de la solicitud para
--    controlar que se reciban los documentos. Se cierra cuando todos
--    están recibidos o el liquidador indica que ya no los necesita.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. document_requirements — catálogo de documentos por línea de negocio
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  business_line_id uuid REFERENCES business_lines(id) ON DELETE SET NULL,
  country_id uuid REFERENCES countries(id) ON DELETE SET NULL,
  document_type_code text NOT NULL,
  document_name text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_req_business_line
  ON document_requirements(business_line_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_company
  ON document_requirements(company_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_active
  ON document_requirements(is_active);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION trg_document_requirements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_requirements_updated_at ON document_requirements;
CREATE TRIGGER document_requirements_updated_at
  BEFORE UPDATE ON document_requirements
  FOR EACH ROW EXECUTE FUNCTION trg_document_requirements_updated_at();

-- Seed: documentos típicos por línea de negocio (usando name)
INSERT INTO document_requirements (business_line_id, document_type_code, document_name, is_required, sort_order)
SELECT bl.id, 'denuncio', 'Denuncio Carabineros', true, 1
FROM business_lines bl WHERE bl.name = 'Transporte' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'denuncio')
UNION
SELECT bl.id, 'poliza', 'Póliza Vigente', true, 2
FROM business_lines bl WHERE bl.name = 'Transporte' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'poliza')
UNION
SELECT bl.id, 'licencia', 'Licencia de Conducir', true, 3
FROM business_lines bl WHERE bl.name = 'Transporte' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'licencia')
UNION
SELECT bl.id, 'circulacion', 'Permiso de Circulación', false, 4
FROM business_lines bl WHERE bl.name = 'Transporte' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'circulacion')
UNION
SELECT bl.id, 'fotos', 'Fotografías del Daño', true, 5
FROM business_lines bl WHERE bl.name = 'Transporte' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'fotos')
UNION
SELECT bl.id, 'cotizacion', 'Cotización Reparación', false, 6
FROM business_lines bl WHERE bl.name = 'Transporte' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'cotizacion')
ON CONFLICT DO NOTHING;

-- Documentos para hogar
INSERT INTO document_requirements (business_line_id, document_type_code, document_name, is_required, sort_order)
SELECT bl.id, 'poliza', 'Póliza Vigente', true, 1
FROM business_lines bl WHERE bl.name = 'Hogar' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'poliza')
UNION
SELECT bl.id, 'fotos', 'Fotografías del Daño', true, 2
FROM business_lines bl WHERE bl.name = 'Hogar' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'fotos')
UNION
SELECT bl.id, 'cotizacion', 'Cotización Reparación', false, 3
FROM business_lines bl WHERE bl.name = 'Hogar' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'cotizacion')
UNION
SELECT bl.id, 'factura', 'Facturas de Compra', false, 4
FROM business_lines bl WHERE bl.name = 'Hogar' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'factura')
ON CONFLICT DO NOTHING;

-- Documentos para Comercial
INSERT INTO document_requirements (business_line_id, document_type_code, document_name, is_required, sort_order)
SELECT bl.id, 'poliza', 'Póliza Vigente', true, 1
FROM business_lines bl WHERE bl.name = 'Comercial' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'poliza')
UNION
SELECT bl.id, 'fotos', 'Fotografías del Daño', true, 2
FROM business_lines bl WHERE bl.name = 'Comercial' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'fotos')
UNION
SELECT bl.id, 'factura', 'Facturas', false, 3
FROM business_lines bl WHERE bl.name = 'Comercial' AND NOT EXISTS (SELECT 1 FROM document_requirements dr WHERE dr.business_line_id = bl.id AND dr.document_type_code = 'factura')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. claim_document_requests — solicitud de documentos en una gestión
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claim_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_action_id uuid,
  request_number text,
  status text NOT NULL DEFAULT 'requested', -- requested | received | closed | cancelled
  notes text,
  company_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid
);

CREATE INDEX IF NOT EXISTS idx_cdr_claim
  ON claim_document_requests(claim_id);
CREATE INDEX IF NOT EXISTS idx_cdr_action
  ON claim_document_requests(claim_action_id);
CREATE INDEX IF NOT EXISTS idx_cdr_status
  ON claim_document_requests(status);

CREATE OR REPLACE FUNCTION trg_claim_document_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claim_document_requests_updated_at ON claim_document_requests;
CREATE TRIGGER claim_document_requests_updated_at
  BEFORE UPDATE ON claim_document_requests
  FOR EACH ROW EXECUTE FUNCTION trg_claim_document_requests_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 3. claim_document_request_items — items de cada solicitud
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claim_document_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES claim_document_requests(id) ON DELETE CASCADE,
  document_type_code text NOT NULL,
  document_name text NOT NULL,
  status text NOT NULL DEFAULT 'requested', -- requested | received | not_needed
  received_file_url text,
  received_file_id text,
  received_at timestamptz,
  received_by uuid,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdri_request
  ON claim_document_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_cdri_status
  ON claim_document_request_items(status);

CREATE OR REPLACE FUNCTION trg_claim_document_request_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claim_document_request_items_updated_at ON claim_document_request_items;
CREATE TRIGGER claim_document_request_items_updated_at
  BEFORE UPDATE ON claim_document_request_items
  FOR EACH ROW EXECUTE FUNCTION trg_claim_document_request_items_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_document_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_requirements_all" ON document_requirements;
CREATE POLICY "document_requirements_all" ON document_requirements
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "claim_document_requests_all" ON claim_document_requests;
CREATE POLICY "claim_document_requests_all" ON claim_document_requests
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "claim_document_request_items_all" ON claim_document_request_items;
CREATE POLICY "claim_document_request_items_all" ON claim_document_request_items
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 5. Pantalla recepcion_docs
-- ═══════════════════════════════════════════════════════════════
INSERT INTO gestion_screens (code, name, description, is_active, sort_order, form_schema)
VALUES (
  'recepcion_docs',
  'Recepción de Documentos',
  'Control de recepción de documentos solicitados',
  true,
  55,
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
    jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
    jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
    jsonb_build_object('id','doc_receipt','category','complex_entity','type','claim_document_receipt','label','Recepción de Documentos')
  ))
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  form_schema = EXCLUDED.form_schema;
