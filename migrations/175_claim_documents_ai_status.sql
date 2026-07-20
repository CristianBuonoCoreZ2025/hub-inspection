-- Migration 175: Agregar columna ai_status a claim_documents
-- Para saber si el documento está siendo procesado en background (IA + optimización).
-- Estados: pending (en proceso), done (IA completada), error (IA falló), skipped (IA omitida, ej: mime no soportado)

ALTER TABLE claim_documents
  ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'pending';

-- Marcar documentos existentes como 'done' (ya fueron procesados al subir)
UPDATE claim_documents SET ai_status = 'done' WHERE ai_status IS NULL OR ai_status = 'pending';

COMMENT ON COLUMN claim_documents.ai_status IS 'Estado del procesamiento IA: pending (en proceso), done (completado), error (falló), skipped (omitido)';
