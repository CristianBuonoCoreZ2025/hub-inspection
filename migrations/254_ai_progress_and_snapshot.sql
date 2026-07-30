-- ═══════════════════════════════════════════════════════════════
-- Migración 254: Trazabilidad de prompts IA + progreso en tiempo real
--
-- ai_progress TEXT:      estado actual del procesamiento (ej: "vision:qwen-vl:✗|gemma")
--                        se actualiza en tiempo real mientras se prueba cada modelo
-- ai_prompt_snapshot JSONB: copia del prompt usado (system + user + refinement)
--                        para auditoría — si alguien edita el prompt, los análisis
--                        antiguos conservan el prompt con que se hicieron
--
-- Tablas afectadas: claim_images, claim_documents, inspection_evidences, policy_documents
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE claim_images ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE claim_images ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;

ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;

ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;

ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;
