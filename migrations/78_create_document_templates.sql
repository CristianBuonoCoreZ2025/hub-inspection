-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 78: Document Templates (Plantillas de documentos Word)
-- Permite asociar plantillas .docx a gestiones (action_template)
-- con placeholders tipo {claim_number} que se rellenan con datos
-- del siniestro al generar el informe de liquidación.
--
-- Asociaciones: por compañía (company_id), evento (event_id) y
-- gestión (action_template_id). Cualquier NULL significa "aplica a todos".
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  action_template_id UUID REFERENCES action_template(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,

  name            TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,            -- URL Nhost Storage
  file_id         TEXT,                     -- ID del archivo en Nhost Storage
  file_name       TEXT NOT NULL,            -- nombre original del .docx
  file_size       BIGINT,
  mime_type       TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  -- Placeholders detectados automáticamente al subir (array de strings, ej: ["claim_number","insured_name"])
  detected_placeholders JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Mapeo manual placeholder -> campo del siniestro (ej: {"num_siniestro": "claim_number"})
  placeholder_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_document_templates_company ON document_templates(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_templates_action ON document_templates(action_template_id) WHERE action_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_templates_event ON document_templates(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active) WHERE is_active = true;

-- updated_at trigger
CREATE OR REPLACE FUNCTION trg_document_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_templates_updated_at ON document_templates;
CREATE TRIGGER document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION trg_document_templates_updated_at();

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_templates_select" ON document_templates;
CREATE POLICY "document_templates_select" ON document_templates
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "document_templates_insert" ON document_templates;
CREATE POLICY "document_templates_insert" ON document_templates
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "document_templates_update" ON document_templates;
CREATE POLICY "document_templates_update" ON document_templates
  FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "document_templates_delete" ON document_templates;
CREATE POLICY "document_templates_delete" ON document_templates
  FOR DELETE TO public USING (true);

COMMENT ON TABLE document_templates IS 'Plantillas de documentos Word (.docx) asociadas a gestiones, con placeholders que se rellenan con datos del siniestro';
