-- Migration 172: Agregar columnas ai_summary y ai_model a claim_documents
-- Para guardar el resumen automático generado por OpenRouter al subir documentos.

ALTER TABLE claim_documents
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_model text;

-- Comentario para documentación
COMMENT ON COLUMN claim_documents.ai_summary IS 'Resumen automático generado por IA (OpenRouter) al subir el documento';
COMMENT ON COLUMN claim_documents.ai_model IS 'Modelo de IA usado para generar el resumen (ej: qwen/qwen-2.5-vl-72b-instruct:free)';
