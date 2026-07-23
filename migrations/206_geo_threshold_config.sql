-- ═══════════════════════════════════════════════════════════════
-- Migration 206: Configuración del umbral de geolocalización
--
-- Crea una tabla de configuración del sistema y establece el umbral
-- por defecto para la validación de proximidad en inspecciones.
--
-- El umbral se lee en runtime y puede modificarse desde la
-- configuración del sistema sin deploy.
-- ═══════════════════════════════════════════════════════════════

-- Tabla de configuración del sistema (key/value)
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE system_settings IS 'Configuración clave/valor del sistema. Modificable en runtime.';

-- Insertar umbral por defecto: 500 metros
INSERT INTO system_settings (key, value, description)
VALUES (
  'geo_threshold_meters',
  '500',
  'Distancia máxima en metros entre la ubicación capturada y la dirección del siniestro para considerar la inspección como "verificada". Valores típicos: 10, 50, 100, 500, 5000.'
)
ON CONFLICT (key) DO NOTHING;

-- Índice útil para lookups frecuentes
CREATE INDEX IF NOT EXISTS idx_system_settings_key
  ON system_settings (key)
  WHERE is_active = true;
