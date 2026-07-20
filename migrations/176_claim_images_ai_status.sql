-- Migration 176: Agregar columna ai_status a claim_images
-- Para saber si la imagen está siendo procesada en background (IA + optimización).

ALTER TABLE claim_images
  ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'pending';

-- Marcar imágenes existentes como 'done' (ya fueron procesadas al subir)
UPDATE claim_images SET ai_status = 'done' WHERE ai_status IS NULL OR ai_status = 'pending';

COMMENT ON COLUMN claim_images.ai_status IS 'Estado del procesamiento IA: pending (en proceso), done (completado), error (falló), skipped (omitido)';
