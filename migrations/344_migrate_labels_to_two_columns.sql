-- ═══════════════════════════════════════════════════════════════
-- Migración 344: Migrar field_config.labels de string a 2 columnas
-- ═══════════════════════════════════════════════════════════════
-- Objetivo: Convertir los labels de las clasificaciones del formato
-- string plano a formato de 2 columnas {residential, commercial}
-- según los destinos relacionados de cada clasificación.
--
-- Reglas:
-- - Clasificación solo residential → labels a {residential: "..."}
-- - Clasificación solo commercial  → labels a {commercial: "..."}
-- - Clasificación ambos (Edificio, Otros):
--   * Si el label coincide con el destino residential → residential = valor, commercial = label del destino commercial
--   * Si el label coincide con el destino commercial  → commercial = valor, residential = label del destino residential
--   * Si no coincide con ninguno (label propio) → va en ambas columnas
--
-- NO se borran datos. Se hace backup del field_config antes de migrar.
-- ═══════════════════════════════════════════════════════════════

-- 1. Backup de seguridad: guardar field_config original en una columna temporal
ALTER TABLE property_classifications
  ADD COLUMN IF NOT EXISTS field_config_backup jsonb;

UPDATE property_classifications
  SET field_config_backup = field_config
  WHERE field_config IS NOT NULL AND field_config_backup IS NULL;

-- 2. Migración con PL/pgSQL
DO $$
DECLARE
  cls RECORD;
  dest_types text[];
  residential_labels jsonb;
  commercial_labels jsonb;
  old_labels jsonb;
  new_labels jsonb;
  label_key text;
  label_value text;
  residential_val text;
  commercial_val text;
  new_entry jsonb;
BEGIN
  -- Obtener labels de los destinos base
  SELECT field_config->'labels' INTO residential_labels
    FROM housing_destinations WHERE destination_type = 'residential' LIMIT 1;
  SELECT field_config->'labels' INTO commercial_labels
    FROM housing_destinations WHERE destination_type = 'commercial' LIMIT 1;

  -- Iterar sobre cada clasificación
  FOR cls IN
    SELECT pc.id, pc.field_config
    FROM property_classifications pc
    WHERE pc.field_config IS NOT NULL
      AND pc.field_config->'labels' IS NOT NULL
      AND jsonb_typeof(pc.field_config->'labels') = 'object'
  LOOP
    -- Obtener los tipos de destino relacionados
    SELECT array_agg(DISTINCT hd.destination_type)
      INTO dest_types
      FROM classification_destinations cd
      JOIN housing_destinations hd ON cd.destination_id = hd.id
      WHERE cd.classification_id = cls.id AND hd.destination_type IS NOT NULL;

    -- Si no hay relaciones, skip
    IF dest_types IS NULL OR array_length(dest_types, 1) IS NULL THEN
      CONTINUE;
    END IF;

    old_labels := cls.field_config->'labels';
    new_labels := '{}'::jsonb;

    -- Iterar sobre cada label
    FOR label_key, label_value IN
      SELECT key, value::text
      FROM jsonb_each_text(old_labels)
    LOOP
      -- Quitar comillas del value
      label_value := BTRIM(label_value, '"');

      IF 'residential' = ANY(dest_types) AND 'commercial' = ANY(dest_types) THEN
        -- Ambos destinos: determinar a qué columna va
        residential_val := NULL;
        commercial_val := NULL;

        -- Si el label coincide con el destino residential
        IF residential_labels ? label_key AND (residential_labels->>label_key) = label_value THEN
          residential_val := label_value;
          -- Commercial: tomar del destino commercial si existe, sino el mismo
          IF commercial_labels ? label_key THEN
            commercial_val := commercial_labels->>label_key;
          ELSE
            commercial_val := label_value;
          END IF;
        -- Si el label coincide con el destino commercial
        ELSIF commercial_labels ? label_key AND (commercial_labels->>label_key) = label_value THEN
          commercial_val := label_value;
          -- Residential: tomar del destino residential si existe, sino el mismo
          IF residential_labels ? label_key THEN
            residential_val := residential_labels->>label_key;
          ELSE
            residential_val := label_value;
          END IF;
        ELSE
          -- Label propio de la clasificación (no coincide con ningún destino)
          -- Va en ambas columnas
          residential_val := label_value;
          commercial_val := label_value;
        END IF;

        new_entry := jsonb_build_object(
          'residential', residential_val,
          'commercial', commercial_val
        );
        new_labels := new_labels || jsonb_build_object(label_key, new_entry);

      ELSIF 'residential' = ANY(dest_types) THEN
        -- Solo residential
        new_labels := new_labels || jsonb_build_object(
          label_key, jsonb_build_object('residential', label_value)
        );

      ELSIF 'commercial' = ANY(dest_types) THEN
        -- Solo commercial
        new_labels := new_labels || jsonb_build_object(
          label_key, jsonb_build_object('commercial', label_value)
        );
      END IF;
    END LOOP;

    -- Actualizar el field_config con los nuevos labels
    UPDATE property_classifications
      SET field_config = jsonb_set(field_config, '{labels}', new_labels)
      WHERE id = cls.id;

    RAISE NOTICE 'Migrado: % (dest_types: %)', cls.id, dest_types;
  END LOOP;
END $$;

-- 3. Verificación
-- SELECT name, field_config->'labels' AS labels FROM property_classifications ORDER BY name;
