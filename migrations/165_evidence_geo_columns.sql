-- ═══════════════════════════════════════════════════════════════
-- Migration 165: Columnas de geolocalización en inspection_evidences
-- ═══════════════════════════════════════════════════════════════
-- Agrega columnas dedicadas para lat/lng del dispositivo y del EXIF
-- de la foto, para poder consultar e indexar por ubicación.
--
-- Columnas:
--   lat       — latitud del dispositivo al subir (geolocation API)
--   lng       — longitud del dispositivo al subir
--   exif_lat  — latitud extraída de los metadatos EXIF de la foto
--   exif_lng  — longitud extraída de los metadatos EXIF de la foto
--
-- Esto permite:
--   - Query por ubicación: WHERE lat BETWEEN -33.5 AND -33.4
--   - Detectar fraudes: WHERE exif_lat IS NOT NULL AND
--       abs(lat - exif_lat) > 0.01
--   - Índices espaciales futuros
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS exif_lat double precision,
  ADD COLUMN IF NOT EXISTS exif_lng double precision;

COMMENT ON COLUMN inspection_evidences.lat IS
  'Latitud del dispositivo al subir la evidencia (geolocation API del navegador)';
COMMENT ON COLUMN inspection_evidences.lng IS
  'Longitud del dispositivo al subir la evidencia';
COMMENT ON COLUMN inspection_evidences.exif_lat IS
  'Latitud extraída de los metadatos EXIF GPS de la foto (ubicación real donde se tomó)';
COMMENT ON COLUMN inspection_evidences.exif_lng IS
  'Longitud extraída de los metadatos EXIF GPS de la foto';

-- Índice para consultas por ubicación del dispositivo
CREATE INDEX IF NOT EXISTS idx_inspection_evidences_lat_lng
  ON inspection_evidences(lat, lng)
  WHERE lat IS NOT NULL;

-- Índice para consultas por ubicación EXIF de la foto
CREATE INDEX IF NOT EXISTS idx_inspection_evidences_exif_lat_lng
  ON inspection_evidences(exif_lat, exif_lng)
  WHERE exif_lat IS NOT NULL;
