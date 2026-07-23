-- ═══════════════════════════════════════════════════════════════
-- Migration 201: Geolocalización de inspecciones
--
-- Agrega campos para:
-- 1. Coordenadas de la dirección del siniestro (claims)
-- 2. Coordenadas capturadas en la inspección (inspection_sessions)
-- 3. Validación de cercanía (distancia + estado)
-- 4. URL del mapa estático guardado como evidencia
--
-- Umbral de cercanía: 500 metros (configurable por app)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Coordenadas de la dirección del siniestro ──
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS claim_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS claim_longitude DOUBLE PRECISION;

COMMENT ON COLUMN claims.claim_latitude IS 'Latitud de la dirección del siniestro (geocodificada). Migration 201.';
COMMENT ON COLUMN claims.claim_longitude IS 'Longitud de la dirección del siniestro (geocodificada). Migration 201.';

-- ── 2. Coordenadas capturadas en la inspección ──
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS geo_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geo_captured_by UUID,
  ADD COLUMN IF NOT EXISTS geo_distance_meters INTEGER,
  ADD COLUMN IF NOT EXISTS geo_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS geo_map_url TEXT;

COMMENT ON COLUMN inspection_sessions.geo_latitude IS 'Latitud capturada por inspector (presencial) o usuario (remota). Migration 201.';
COMMENT ON COLUMN inspection_sessions.geo_longitude IS 'Longitud capturada por inspector (presencial) o usuario (remota). Migration 201.';
COMMENT ON COLUMN inspection_sessions.geo_captured_at IS 'Fecha/hora de la captura de geolocalización. Migration 201.';
COMMENT ON COLUMN inspection_sessions.geo_captured_by IS 'Usuario que capturó la geolocalización (inspector o asegurado). Migration 201.';
COMMENT ON COLUMN inspection_sessions.geo_distance_meters IS 'Distancia en metros entre la geo capturada y la dirección del siniestro. Migration 201.';
COMMENT ON COLUMN inspection_sessions.geo_status IS 'Estado de validación: pending, verified, out_of_range, failed. Migration 201.';
COMMENT ON COLUMN inspection_sessions.geo_map_url IS 'URL del mapa estático guardado como evidencia. Migration 201.';

-- ── 3. Catálogo de estados de geolocalización ──
INSERT INTO lookup_catalog (category, code, name, sort_order, is_active)
VALUES
  ('geo_status', 'pending', 'Pendiente', 1, true),
  ('geo_status', 'verified', 'Verificada', 2, true),
  ('geo_status', 'out_of_range', 'Fuera de rango', 3, true),
  ('geo_status', 'failed', 'Fallida', 4, true)
ON CONFLICT DO NOTHING;

-- ── 4. Configuración del umbral de cercanía ──
-- Se almacena en una tabla de configuración o se hardcodea en la app
-- Por ahora se hardcodea en src/lib/geo.ts como GEO_THRESHOLD_METERS = 500
