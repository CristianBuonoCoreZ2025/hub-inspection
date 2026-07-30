-- ═══════════════════════════════════════════════════════════════
-- Migración 280: Columna ai_analyzed_at
--
-- Guarda la fecha en que se realizó el análisis de IA de cada archivo.
-- Distinta de updated_at (que cambia en cualquier update) y de
-- created_at (que es la fecha de subida, no de análisis).
--
-- Tablas afectadas: claim_images, claim_documents, inspection_evidences
-- (policy_documents no tiene ai_status, se omite).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE claim_images ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
