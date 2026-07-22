-- Migración 183: Limpiar campos inútiles de la pantalla "generica"
--
-- Quita inf_palabras (Palabras Clave) e inf_en_proceso (En Proceso)
-- de la pantalla "generica" porque:
--   - El usuario confirmó que no sirven para nada
--   - Ninguna claim_action tiene datos en esos campos (verificado)
--   - Son campos confusos que ocupan espacio sin valor
--
-- Seguro: solo modifica el JSON form_schema, no toca datos transaccionales.

UPDATE gestion_screens
SET form_schema = (
  SELECT jsonb_set(
    form_schema,
    '{fields}',
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(form_schema->'fields') AS elem
      WHERE elem->>'id' NOT IN ('inf_palabras', 'inf_en_proceso')
    )
  )
  WHERE code = 'generica'
)
WHERE code = 'generica'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(form_schema->'fields') AS elem
    WHERE elem->>'id' IN ('inf_palabras', 'inf_en_proceso')
  );

-- Verificación
DO $$
DECLARE
  field_count int;
BEGIN
  SELECT jsonb_array_length(form_schema->'fields') INTO field_count
  FROM gestion_screens WHERE code = 'generica' LIMIT 1;
  RAISE NOTICE 'Pantalla "generica" ahora tiene % campos', field_count;
END $$;
