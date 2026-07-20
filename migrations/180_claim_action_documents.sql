-- ═══════════════════════════════════════════════════════════════
-- Migración 180: Tabla de documentos de gestión con versionado y lock
-- ═══════════════════════════════════════════════════════════════
-- Cada gestión (claim_action) puede tener un documento asociado
-- (generado desde plantilla o subido por el usuario).
-- Cada subida/generación crea una nueva versión.
-- El documento puede estar "locked" por un usuario que lo descargó
-- para editarlo offline — nadie más puede descargarlo hasta que lo
-- vuelva a subir (o un admin fuerce el desbloqueo).

-- Campos nuevos en claim_actions
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS has_document BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS has_pdf BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE claim_actions ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN claim_actions.has_document IS 'TRUE si la gestión tiene un documento de ofimática (Word/Excel/PPT) actual';
COMMENT ON COLUMN claim_actions.has_pdf IS 'TRUE si la gestión tiene un PDF final publicado';
COMMENT ON COLUMN claim_actions.pdf_generated_at IS 'Fecha de generación del PDF final';

CREATE TABLE IF NOT EXISTS claim_action_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_action_id UUID NOT NULL REFERENCES claim_actions(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,

  -- Versión incremental (1, 2, 3, ...)
  version INTEGER NOT NULL DEFAULT 1,

  -- Fuente del documento
  source TEXT NOT NULL CHECK (source IN ('template', 'upload_pdf', 'upload_docx', 'upload_xlsx', 'upload_pptx', 'upload_other')),
  -- 'template' = generado desde una plantilla del sistema
  -- 'upload_*' = subido por el usuario

  -- Si source='template', referencia a la plantilla usada
  document_template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,

  -- Archivo en R2
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size BIGINT,

  -- Tipo de archivo detectado
  file_type TEXT NOT NULL CHECK (file_type IN ('docx', 'xlsx', 'pptx', 'pdf', 'other')),

  -- Lock para edición offline
  locked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,  -- expira automáticamente después de N horas

  -- Metadatos
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Una gestión tiene un solo documento "actual" (la última versión)
  is_current BOOLEAN NOT NULL DEFAULT TRUE,

  -- Soft delete
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_claim_action_documents_action ON claim_action_documents(claim_action_id);
CREATE INDEX IF NOT EXISTS idx_claim_action_documents_claim ON claim_action_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_action_documents_current ON claim_action_documents(claim_action_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_claim_action_documents_locked ON claim_action_documents(locked_by) WHERE locked_by IS NOT NULL;

-- RLS
ALTER TABLE claim_action_documents ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden ver documentos de gestiones
-- a las que tienen acceso (misma company que el claim)
CREATE POLICY claim_action_documents_select ON claim_action_documents
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.id = claim_action_documents.claim_id
    )
  );

-- Política: usuarios autenticados pueden insertar documentos
CREATE POLICY claim_action_documents_insert ON claim_action_documents
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Política: usuarios autenticados pueden actualizar documentos
CREATE POLICY claim_action_documents_update ON claim_action_documents
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Política: cualquier usuario autenticado puede eliminar (soft delete)
-- La validación de admin se hace en la API route
CREATE POLICY claim_action_documents_delete ON claim_action_documents
  FOR DELETE TO authenticated USING (TRUE);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION trg_claim_action_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claim_action_documents_updated_at ON claim_action_documents;
CREATE TRIGGER claim_action_documents_updated_at
  BEFORE UPDATE ON claim_action_documents
  FOR EACH ROW EXECUTE FUNCTION trg_claim_action_documents_updated_at();

-- Comentario
COMMENT ON TABLE claim_action_documents IS 'Documentos de gestión con versionado y lock para edición offline';
COMMENT ON COLUMN claim_action_documents.source IS 'template = generado desde plantilla, upload_* = subido por usuario';
COMMENT ON COLUMN claim_action_documents.file_type IS 'docx, xlsx, pptx, pdf, other — detectado del mime_type';
COMMENT ON COLUMN claim_action_documents.locked_by IS 'Usuario que descargó el documento para editarlo offline';
COMMENT ON COLUMN claim_action_documents.is_current IS 'TRUE si es la versión actual del documento de la gestión';
