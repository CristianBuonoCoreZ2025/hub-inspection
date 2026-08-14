-- ═══════════════════════════════════════════════════════════════
-- Migración 345: Migrar field_config.show de array a 2 columnas
-- ═══════════════════════════════════════════════════════════════
-- Objetivo: Convertir el array "show" de las clasificaciones a
-- formato de 2 columnas {residential: [...], commercial: [...]}
-- según los destinos relacionados de cada clasificación.
--
-- Reglas:
-- - Clasificación solo residential → show = {residential: [...mismo...], commercial: []}
-- - Clasificación solo commercial  → show = {residential: [], commercial: [...mismo...]}
-- - Clasificación ambos            → show = {residential: [...mismo...], commercial: [...mismo...]}
--   (el usuario luego ajusta campo por campo desde el editor)
--
-- NO se borran datos. field_config_backup ya existe de la migración 344.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  cls RECORD;
  dest_types text[];
  show_array jsonb;
  new_show jsonb;
BEGIN
  FOR cls IN
    SELECT pc.id, pc.field_config
    FROM property_classifications pc
    WHERE pc.field_config IS NOT NULL
      AND pc.field_config ? 'show'
      AND jsonb_typeof(pc.field_config->'show') = 'array'
  LOOP
    -- Obtener los tipos de destino relacionados
    SELECT array_agg(DISTINCT hd.destination_type)
      INTO dest_types
      FROM classification_destinations cd
      JOIN housing_destinations hd ON cd.destination_id = hd.id
      WHERE cd.classification_id = cls.id AND hd.destination_type IS NOT NULL;

    -- Si no hay relaciones, dejar como array (fallback)
    IF dest_types IS NULL OR array_length(dest_types, 1) IS NULL THEN
      RAISE NOTICE 'Skip (sin relaciones): %', cls.id;
      CONTINUE;
    END IF;

    show_array := cls.field_config->'show';

    IF 'residential' = ANY(dest_types) AND 'commercial' = ANY(dest_types) THEN
      -- Ambos: mismo show para ambos (usuario ajusta después)
      new_show := jsonb_build_object(
        'residential', show_array,
        'commercial', show_array
      );
    ELSIF 'residential' = ANY(dest_types) THEN
      -- Solo residential
      new_show := jsonb_build_object(
        'residential', show_array,
        'commercial', '[]'::jsonb
      );
    ELSIF 'commercial' = ANY(dest_types) THEN
      -- Solo commercial
      new_show := jsonb_build_object(
        'residential', '[]'::jsonb,
        'commercial', show_array
      );
    END IF;

    -- Actualizar el field_config con el nuevo show
    UPDATE property_classifications
      SET field_config = jsonb_set(field_config, '{show}', new_show)
      WHERE id = cls.id;

    RAISE NOTICE 'Migrado show: % (dest_types: %)', cls.id, dest_types;
  END LOOP;
END $$;

-- Verificación
-- SELECT name, field_config->'show' AS show FROM property_classifications ORDER BY name;
