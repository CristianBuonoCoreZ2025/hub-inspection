-- ============================================================
-- Hub Inspections -- Migracion 46: Corregir FKs de claims
-- Las FKs destination_housing_id y damage_classification_id
-- referenciaban lookup_catalog pero los servicios usan las tablas originales
-- ============================================================

-- 0. Limpiar valores que referencian lookup_catalog (no existen en las tablas originales)
UPDATE claims SET destination_housing_id = NULL
  WHERE destination_housing_id IS NOT NULL
  AND destination_housing_id NOT IN (SELECT id FROM housing_destinations);

UPDATE claims SET damage_classification_id = NULL
  WHERE damage_classification_id IS NOT NULL
  AND damage_classification_id NOT IN (SELECT id FROM damage_classifications);

-- 1. Eliminar FK constraints que referencian lookup_catalog
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_destination_housing_id_fkey;
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_damage_classification_id_fkey;

-- 2. Agregar FKs correctas a las tablas originales
ALTER TABLE claims
  ADD CONSTRAINT claims_destination_housing_id_fkey
  FOREIGN KEY (destination_housing_id) REFERENCES housing_destinations(id) ON DELETE SET NULL;

ALTER TABLE claims
  ADD CONSTRAINT claims_damage_classification_id_fkey
  FOREIGN KEY (damage_classification_id) REFERENCES damage_classifications(id) ON DELETE SET NULL;
