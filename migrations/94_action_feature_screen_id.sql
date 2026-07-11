-- ═══════════════════════════════════════════════════════════════
-- 94: Relacionar action_feature (característica) con una pantalla
-- Cada action_feature apunta a una sola gestion_screen.
-- Si no tiene screen_id, se usa la pantalla genérica por defecto.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE action_features
  ADD COLUMN IF NOT EXISTS screen_id UUID REFERENCES gestion_screens(id) ON DELETE SET NULL;

COMMENT ON COLUMN action_features.screen_id IS 'Pantalla asociada a esta característica. Se usa para renderizar el formulario correcto al editar una gestión.';

-- Asignar pantalla según nombre/code de la característica
UPDATE action_features
SET screen_id = (
  SELECT id FROM gestion_screens
  WHERE code = CASE
    WHEN action_features.name ILIKE '%inspección%' OR action_features.name ILIKE '%inspection%' OR action_features.name ILIKE '%coordinación%' OR action_features.name ILIKE '%coordination%' THEN 'coordinacion'
    WHEN action_features.name ILIKE '%email%' OR action_features.name ILIKE '%aviso%' OR action_features.name ILIKE '%contacto%' OR action_features.name ILIKE '%notice%' THEN 'email'
    WHEN action_features.name ILIKE '%cobertura%' OR action_features.name ILIKE '%coverage%' THEN 'coberturas'
    WHEN action_features.name ILIKE '%reserva%' OR action_features.name ILIKE '%reserve%' THEN 'reserva'
    WHEN action_features.name ILIKE '%antecedente%' OR action_features.name ILIKE '%documento%' OR action_features.name ILIKE '%background%' OR action_features.name ILIKE '%document%' THEN 'solicitud_docs'
    WHEN action_features.name ILIKE '%liquidación%' OR action_features.name ILIKE '%informe%' OR action_features.name ILIKE '%ajuste%' OR action_features.name ILIKE '%adjustment%' OR action_features.name ILIKE '%report%' THEN 'liquidacion'
    WHEN action_features.name ILIKE '%cierre%' OR action_features.name ILIKE '%closure%' THEN 'cierre'
    WHEN action_features.name ILIKE '%reapertura%' OR action_features.name ILIKE '%reopening%' THEN 'reapertura'
    WHEN action_features.name ILIKE '%prórroga%' OR action_features.name ILIKE '%extension%' THEN 'prorroga'
    WHEN action_features.name ILIKE '%impugnación%' OR action_features.name ILIKE '%respuesta%' OR action_features.name ILIKE '%appeal%' THEN 'impugnacion'
    WHEN action_features.name ILIKE '%indemnización%' OR action_features.name ILIKE '%indemnity%' OR action_features.name ILIKE '%pago%' THEN 'indemnizacion'
    ELSE 'generica'
  END
  LIMIT 1
)
WHERE has_specific_screen = true;

-- Características sin pantalla específica -> null (fallback a generica en runtime)
UPDATE action_features
SET screen_id = (SELECT id FROM gestion_screens WHERE code = 'generica' LIMIT 1)
WHERE screen_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_action_features_screen_id
  ON action_features(screen_id)
  WHERE screen_id IS NOT NULL;
