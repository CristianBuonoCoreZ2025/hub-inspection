-- ═══════════════════════════════════════════════════════════════
-- Migración 343: Destino tipo + relación N:M clasificación ↔ destino
-- ═══════════════════════════════════════════════════════════════
-- Objetivo: Preparar el modelo para que Destino defina el tipo
-- (residential/commercial) y Clasificación defina los campos + labels
-- según el tipo de destino.
--
-- NO se borran columnas ni datos existentes.
-- NO se toca field_config de ninguna tabla.
-- El código usará dual-read: si destination_type existe, usa el modelo
-- nuevo; si no, fallback al modelo viejo.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar destination_type a housing_destinations
--    NULL = no migrado (fallback al modelo viejo)
--    'residential' = habitacional
--    'commercial' = comercial
ALTER TABLE housing_destinations
  ADD COLUMN IF NOT EXISTS destination_type text;

-- 2. Marcar destinos existentes
UPDATE housing_destinations
  SET destination_type = 'residential'
  WHERE name = 'Habitacional' AND destination_type IS NULL;

UPDATE housing_destinations
  SET destination_type = 'commercial'
  WHERE name = 'Comercial' AND destination_type IS NULL;

-- 3. Tabla N:M clasificación ↔ destino
--    Permite que una clasificación (ej: Edificio) se relacione con
--    múltiples destinos (Habitacional + Comercial).
CREATE TABLE IF NOT EXISTS classification_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES property_classifications(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES housing_destinations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(classification_id, destination_id)
);

-- 4. Migrar relaciones según el modelo actual
--    Cada clasificación se relaciona con los destinos donde tiene sentido

-- Habitacional: Casa, Departamento, Edificio, Otros
INSERT INTO classification_destinations (classification_id, destination_id)
SELECT pc.id, hd.id
FROM property_classifications pc
CROSS JOIN housing_destinations hd
WHERE hd.destination_type = 'residential'
  AND pc.name IN ('Casa', 'Departamento', 'Edificio', 'Otros')
ON CONFLICT DO NOTHING;

-- Comercial: Edificio, Galpón, Maquinaria, Oficinas, Otros
INSERT INTO classification_destinations (classification_id, destination_id)
SELECT pc.id, hd.id
FROM property_classifications pc
CROSS JOIN housing_destinations hd
WHERE hd.destination_type = 'commercial'
  AND pc.name IN ('Edificio', 'Galpón', 'Maquinaria', 'Oficinas', 'Otros')
ON CONFLICT DO NOTHING;

-- 5. RLS en la nueva tabla (acceso público, como property_classifications)
ALTER TABLE classification_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classification_destinations_select"
  ON classification_destinations FOR SELECT
  USING (true);

CREATE POLICY "classification_destinations_insert"
  ON classification_destinations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "classification_destinations_update"
  ON classification_destinations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "classification_destinations_delete"
  ON classification_destinations FOR DELETE
  USING (true);

-- 6. GRANTs a los roles de Supabase (anon, authenticated, service_role)
GRANT SELECT, INSERT, UPDATE, DELETE ON classification_destinations TO anon, authenticated, service_role;

-- 6. Verificación (no destructiva)
-- SELECT hd.name AS destino, hd.destination_type, pc.name AS clasificacion
-- FROM classification_destinations cd
-- JOIN housing_destinations hd ON cd.destination_id = hd.id
-- JOIN property_classifications pc ON cd.classification_id = pc.id
-- ORDER BY hd.name, pc.name;
