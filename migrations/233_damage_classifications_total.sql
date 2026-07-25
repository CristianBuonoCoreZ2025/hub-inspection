-- 233_damage_classifications_total.sql
-- Agrega una columna 'code' a damage_classifications para usarla como valor interno
-- (ej: low, medium, high, total) mientras 'name' es la etiqueta visible.
-- Además inserta 'Total' y asigna los códigos a los valores existentes.

ALTER TABLE damage_classifications
  ADD COLUMN IF NOT EXISTS code TEXT;

UPDATE damage_classifications SET code = 'low'    WHERE id = '5382c216-3605-1231-51dc-7ba18e8025fa';
UPDATE damage_classifications SET code = 'medium' WHERE id = '4d58551e-e1f2-5616-c7b8-96adf2266e96';
UPDATE damage_classifications SET code = 'high'   WHERE id = '7870db28-2a60-099c-29be-7a19b3fdb4f8';

INSERT INTO damage_classifications (
  id, name, description, is_active, code
)
SELECT
  gen_random_uuid(),
  'Total',
  'Daño total / pérdida total',
  true,
  'total'
WHERE NOT EXISTS (
  SELECT 1 FROM damage_classifications WHERE name = 'Total'
);