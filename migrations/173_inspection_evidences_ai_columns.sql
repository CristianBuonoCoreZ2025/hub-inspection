-- Migration 173: Agregar columnas ai_summary y ai_model a inspection_evidences y policy_documents
-- Para guardar el análisis automático generado por OpenRouter al subir archivos.

ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_model text;

ALTER TABLE policy_documents
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_model text;

COMMENT ON COLUMN inspection_evidences.ai_summary IS 'Resumen/descripción automático generado por IA (OpenRouter) al subir la evidencia';
COMMENT ON COLUMN inspection_evidences.ai_model IS 'Modelo de IA usado para generar el resumen';
COMMENT ON COLUMN policy_documents.ai_summary IS 'Resumen automático generado por IA (OpenRouter) al subir el documento de póliza';
COMMENT ON COLUMN policy_documents.ai_model IS 'Modelo de IA usado para generar el resumen';
