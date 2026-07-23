-- Migration 203: Agregar ai_status a inspection_evidences
-- Para tracking del proceso background de IA (igual que claim_images).
--
-- Valores:
--   pending  — recién subida, esperando optimización + IA
--   done     — IA generó resumen correctamente
--   skipped  — IA no aplicable a este tipo de archivo
--   error    — IA falló (no crítico, el archivo ya está subido)
--
-- Esto permite:
--  1. Subir el archivo original rápido (sin optimizar ni IA)
--  2. Insertar el registro con ai_status='pending'
--  3. Responder al cliente inmediatamente
--  4. En background (after()): optimizar + IA + actualizar ai_status
--  5. El cliente hace polling cada 5s hasta que ai_status != 'pending'

ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN inspection_evidences.ai_status IS 'Estado del procesamiento de IA: pending | done | skipped | error';

-- Backfill: las evidencias existentes con ai_summary ya tienen IA → 'done'
UPDATE inspection_evidences
  SET ai_status = 'done'
  WHERE ai_summary IS NOT NULL AND ai_status = 'pending';

-- Las evidencias existentes sin ai_summary → 'skipped' (no se reanalizan automáticamente)
UPDATE inspection_evidences
  SET ai_status = 'skipped'
  WHERE ai_summary IS NULL AND ai_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_inspection_evidences_ai_status
  ON inspection_evidences (ai_status)
  WHERE ai_status = 'pending';
