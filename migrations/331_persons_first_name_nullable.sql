-- ============================================================
-- Migracion 331: Hacer persons.first_name nullable y limpiar
-- datos de personas juridicas.
--
-- Razon: persons.first_name era NOT NULL, por lo que para
-- personas juridicas se guardaba la razon social en first_name
-- (duplicada en business_name). Ahora first_name sera null para
-- juridicas y business_name sera la razon social.
-- ============================================================

ALTER TABLE persons ALTER COLUMN first_name DROP NOT NULL;

UPDATE persons
SET
  first_name = NULL,
  last_name = NULL
WHERE person_type = 'legal';

-- Las personas naturales conservan first_name y last_name.
