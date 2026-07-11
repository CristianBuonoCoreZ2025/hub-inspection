-- ═══════════════════════════════════════════════════════════════
-- 93: Simplificar relación: cada characteristic apunta a una sola pantalla
-- Si no tiene screen_id, se usa la pantalla genérica por defecto.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar FK directa de characteristic → gestion_screens
ALTER TABLE characteristic
  ADD COLUMN IF NOT EXISTS screen_id UUID REFERENCES gestion_screens(id) ON DELETE SET NULL;

COMMENT ON COLUMN characteristic.screen_id IS 'Pantalla que se renderiza cuando una gestión con esta característica se edita. NULL = pantalla genérica.';

-- 2. Asignar pantalla particular según el nombre/local_name de la característica
UPDATE characteristic
SET screen_id = (
  SELECT id FROM gestion_screens
  WHERE code = CASE
    WHEN characteristic.local_name ILIKE '%inspección%' OR characteristic.name ILIKE '%inspection%' OR characteristic.local_name ILIKE '%coordinación%' THEN 'coordinacion'
    WHEN characteristic.local_name ILIKE '%email%' OR characteristic.local_name ILIKE '%aviso%' OR characteristic.local_name ILIKE '%contacto%' OR characteristic.email_template = true THEN 'email'
    WHEN characteristic.local_name ILIKE '%cobertura%' OR characteristic.name ILIKE '%coverage%' THEN 'coberturas'
    WHEN characteristic.local_name ILIKE '%reserva%' OR characteristic.name ILIKE '%reserve%' THEN 'reserva'
    WHEN characteristic.local_name ILIKE '%antecedente%' OR characteristic.local_name ILIKE '%documento%' OR characteristic.local_name ILIKE '%recepción%' THEN 'solicitud_docs'
    WHEN characteristic.local_name ILIKE '%liquidación%' OR characteristic.local_name ILIKE '%informe%' OR characteristic.local_name ILIKE '%ajuste%' OR characteristic.name ILIKE '%adjustment%' OR characteristic.name ILIKE '%report%' THEN 'liquidacion'
    WHEN characteristic.local_name ILIKE '%cierre%' OR characteristic.name ILIKE '%closure%' THEN 'cierre'
    WHEN characteristic.local_name ILIKE '%reapertura%' OR characteristic.name ILIKE '%reopening%' THEN 'reapertura'
    WHEN characteristic.local_name ILIKE '%prórroga%' OR characteristic.name ILIKE '%extension%' THEN 'prorroga'
    WHEN characteristic.local_name ILIKE '%impugnación%' OR characteristic.local_name ILIKE '%respuesta%' OR characteristic.name ILIKE '%appeal%' THEN 'impugnacion'
    WHEN characteristic.local_name ILIKE '%indemnización%' OR characteristic.name ILIKE '%indemnity%' OR characteristic.local_name ILIKE '%pago%' THEN 'indemnizacion'
    ELSE 'generica'
  END
  LIMIT 1
)
WHERE characteristic.screen = true OR characteristic.email_template = true OR characteristic.document_template = true;

-- 3. Características sin pantalla particular (que NO son screen/email_template/document_template) -> null
-- Quedarán con screen_id NULL y el sistema hará fallback a generica.

-- 4. Asegurar que todas las características de tipo screen tengan un screen_id asignado (fallback generica)
UPDATE characteristic
SET screen_id = (SELECT id FROM gestion_screens WHERE code = 'generica' LIMIT 1)
WHERE screen_id IS NULL AND screen = true;

-- 5. Crear índice
CREATE INDEX IF NOT EXISTS idx_characteristic_screen_id
  ON characteristic(screen_id)
  WHERE screen_id IS NOT NULL;
