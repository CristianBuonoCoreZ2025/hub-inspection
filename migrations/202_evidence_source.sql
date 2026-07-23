-- ═══════════════════════════════════════════════════════════════
-- Migration 202: Campo source en inspection_evidences
--
-- Distingue el origen de las evidencias:
--   upload              → subida manual (foto/video/archivo)
--   screenshot_inspector → capturada en vivo por el inspector desde el video
--   screenshot_client   → capturada en vivo por el cliente desde el video
--   live_video          → grabación de video de la sesión en vivo
--   geo_map             → mapa de geolocalización (generado automáticamente)
--
-- Esto permite identificar evidencias capturadas en vivo (anti-fraude)
-- vs subidas manualmente por el cliente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'upload';

COMMENT ON COLUMN inspection_evidences.source IS 'Origen de la evidencia: upload, screenshot_inspector, screenshot_client, live_video, geo_map. Migration 202.';

-- Actualizar evidencias existentes de mapa de geolocalización
UPDATE inspection_evidences
SET source = 'geo_map'
WHERE metadata->>'source' = 'geo_map';
