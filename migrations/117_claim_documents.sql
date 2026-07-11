-- ═══════════════════════════════════════════════════════════════
-- Migración 117: claim_documents — agregar columnas faltantes
--
-- La tabla claim_documents ya existe con una estructura anterior.
-- Agregamos is_active, document_name, document_url, document_type
-- para alinearla con policy_documents y soportar soft delete.
-- ═══════════════════════════════════════════════════════════════

-- Agregar columnas para compatibilidad con el patrón de policy_documents
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS document_name text;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Migrar datos existentes a las nuevas columnas
UPDATE claim_documents
SET document_name = COALESCE(document_name, original_filename),
    document_url = COALESCE(document_url, file_url),
    document_type = COALESCE(document_type, mime_type)
WHERE document_name IS NULL OR document_url IS NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_documents_active ON claim_documents(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_documents_all" ON claim_documents;
CREATE POLICY "claim_documents_all" ON claim_documents
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at (reutiliza la función existente)
DROP TRIGGER IF EXISTS claim_documents_updated_at ON claim_documents;
CREATE TRIGGER claim_documents_updated_at
  BEFORE UPDATE ON claim_documents
  FOR EACH ROW EXECUTE FUNCTION trg_policies_updated_at();
