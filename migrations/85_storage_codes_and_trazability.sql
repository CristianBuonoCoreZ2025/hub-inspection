-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 85: Códigos configurables + tablas de trazabilidad
--
-- 1. Agregar code_prefix a business_lines (H, C, R, V...)
-- 2. Agregar code a action_features (INS, ILI, PCA...)
-- 3. Tabla template_usage_log (qué template se usó en cada gestión)
-- 4. Tabla template_modification_log (historial de modificaciones)
-- 5. Tabla claim_documents (documentos del siniestro)
-- 6. Tabla claim_document_gestions (vinculación doc ↔ gestión)
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. business_lines.code_prefix ═══
ALTER TABLE business_lines
  ADD COLUMN IF NOT EXISTS code_prefix text;

-- Seed con matches exactos (case-insensitive)
UPDATE business_lines SET code_prefix = 'H' WHERE name ILIKE 'hogar' AND code_prefix IS NULL;
UPDATE business_lines SET code_prefix = 'C' WHERE name ILIKE 'comercial' AND code_prefix IS NULL;
UPDATE business_lines SET code_prefix = 'R' WHERE name ILIKE 'responsabilidad civil' AND code_prefix IS NULL;
UPDATE business_lines SET code_prefix = 'V' WHERE name ILIKE 'vida' AND code_prefix IS NULL;
UPDATE business_lines SET code_prefix = 'T' WHERE name ILIKE 'transporte' AND code_prefix IS NULL;

-- Constraint único (solo si no hay nulls duplicados — los nulls están permitidos)
ALTER TABLE business_lines
  DROP CONSTRAINT IF EXISTS business_lines_code_prefix_key;
ALTER TABLE business_lines
  ADD CONSTRAINT business_lines_code_prefix_key UNIQUE (code_prefix);

-- ═══ 2. action_features.code ═══
ALTER TABLE action_features
  ADD COLUMN IF NOT EXISTS code text;

-- Seed con matches exactos (case-insensitive) para evitar duplicados
UPDATE action_features SET code = 'INS' WHERE name ILIKE 'inspecci%n' AND code IS NULL;
UPDATE action_features SET code = 'ILI' WHERE name ILIKE 'informe de liquidaci%n' AND code IS NULL;
UPDATE action_features SET code = 'PCA' WHERE name ILIKE 'carta propuesta al asegurado' AND code IS NULL;
UPDATE action_features SET code = 'CIN' WHERE name ILIKE 'coordinaci%n inspecci%n' AND code IS NULL;
UPDATE action_features SET code = 'SOL' WHERE name ILIKE 'solicitud de antecedentes' AND code IS NULL;
UPDATE action_features SET code = 'RES' WHERE name ILIKE 'reserva' AND code IS NULL;
UPDATE action_features SET code = 'IMP' WHERE name ILIKE 'impugnaci%n' AND code IS NULL;
UPDATE action_features SET code = 'RPA' WHERE name ILIKE 'recepci%n de pr%rroga%' AND code IS NULL;
UPDATE action_features SET code = 'RTA' WHERE name ILIKE 'recepci%n total antecedentes' AND code IS NULL;
UPDATE action_features SET code = 'RPR' WHERE name ILIKE 'reporte preliminar' AND code IS NULL;
UPDATE action_features SET code = 'CIE' WHERE name ILIKE 'cierre' AND code IS NULL;
UPDATE action_features SET code = 'REA' WHERE name ILIKE 'reapertura' AND code IS NULL;
UPDATE action_features SET code = 'ADD' WHERE name ILIKE 'addendum' AND code IS NULL;
UPDATE action_features SET code = 'AJU' WHERE name ILIKE 'ajuste' AND code IS NULL;
UPDATE action_features SET code = 'AVI' WHERE name ILIKE 'aviso asignaci%n' AND code IS NULL;
UPDATE action_features SET code = 'COB' WHERE name ILIKE 'cobertura' AND code IS NULL;
UPDATE action_features SET code = 'CEA' WHERE name ILIKE 'contacto email asegurado' AND code IS NULL;
UPDATE action_features SET code = 'GEN' WHERE name ILIKE 'gen%rica' AND code IS NULL;
UPDATE action_features SET code = 'PRO' WHERE name ILIKE 'pr%rroga de siniestro' AND code IS NULL;
UPDATE action_features SET code = 'RIN' WHERE name ILIKE 'registro de indemnizaci%n' AND code IS NULL;
UPDATE action_features SET code = 'RIM' WHERE name ILIKE 'respuesta de impugnaci%n' AND code IS NULL;
UPDATE action_features SET code = 'DES' WHERE name ILIKE 'solicitud de despacho' AND code IS NULL;

-- Constraint único
ALTER TABLE action_features
  DROP CONSTRAINT IF EXISTS action_features_code_key;
ALTER TABLE action_features
  ADD CONSTRAINT action_features_code_key UNIQUE (code);

-- ═══ 3. template_usage_log ═══
CREATE TABLE IF NOT EXISTS template_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_template_id uuid NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES claims(id) ON DELETE SET NULL,
  claim_action_id uuid,
  used_by uuid,
  used_at timestamptz NOT NULL DEFAULT now(),
  template_hash text,
  template_file_url text NOT NULL,
  template_name text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_template_usage_log_template
  ON template_usage_log(document_template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_claim
  ON template_usage_log(claim_id) WHERE claim_id IS NOT NULL;

-- ═══ 4. template_modification_log ═══
CREATE TABLE IF NOT EXISTS template_modification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_template_id uuid NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  modified_by uuid,
  modified_at timestamptz NOT NULL DEFAULT now(),
  old_file_url text,
  new_file_url text NOT NULL,
  old_hash text,
  new_hash text,
  change_description text
);

CREATE INDEX IF NOT EXISTS idx_template_modification_log_template
  ON template_modification_log(document_template_id);

-- ═══ 5. claim_documents ═══
CREATE TABLE IF NOT EXISTS claim_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  doc_code text NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  original_filename text,
  type text,
  mime_type text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_documents_claim
  ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_documents_code
  ON claim_documents(doc_code);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trg_claim_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claim_documents_updated_at ON claim_documents;
CREATE TRIGGER claim_documents_updated_at
  BEFORE UPDATE ON claim_documents
  FOR EACH ROW EXECUTE FUNCTION trg_claim_documents_updated_at();

-- ═══ 6. claim_document_gestions (vinculación sin duplicar) ═══
CREATE TABLE IF NOT EXISTS claim_document_gestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES claim_documents(id) ON DELETE CASCADE,
  claim_action_id uuid NOT NULL,
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, claim_action_id)
);

CREATE INDEX IF NOT EXISTS idx_claim_document_gestions_doc
  ON claim_document_gestions(document_id);
CREATE INDEX IF NOT EXISTS idx_claim_document_gestions_gestion
  ON claim_document_gestions(claim_action_id);

-- ═══ RLS ═══
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_modification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_document_gestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template_usage_log_all" ON template_usage_log;
CREATE POLICY "template_usage_log_all" ON template_usage_log
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "template_modification_log_all" ON template_modification_log;
CREATE POLICY "template_modification_log_all" ON template_modification_log
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "claim_documents_all" ON claim_documents;
CREATE POLICY "claim_documents_all" ON claim_documents
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "claim_document_gestions_all" ON claim_document_gestions;
CREATE POLICY "claim_document_gestions_all" ON claim_document_gestions
  FOR ALL TO public USING (true) WITH CHECK (true);
