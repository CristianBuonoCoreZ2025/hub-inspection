-- ============================================================
-- Hub Inspections — Migracion 358: Separar first_name/last_name
--
-- 762 personas naturales en claims_participants sin last_name.
-- De esas, 643 tienen full_name con 3+ palabras (caso seguro):
--   últimos 2 tokens = apellidos, resto = nombre
-- Los casos de 2 palabras (91) y 1 palabra (23) se dejan para revisión manual.
-- ============================================================

-- Caso 3 palabras: 1 nombre + 2 apellidos
UPDATE claims_participants
SET
  first_name = split_part(full_name, ' ', 1),
  last_name = split_part(full_name, ' ', 2) || ' ' || split_part(full_name, ' ', 3),
  updated_at = NOW()
WHERE rut IS NOT NULL AND TRIM(rut) <> ''
  AND rut LIKE '%-%'
  AND rut NOT LIKE '%.%'
  AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\D', '', 'g'), '')::bigint < 50000000
  AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
  AND full_name IS NOT NULL AND TRIM(full_name) <> ''
  AND array_length(string_to_array(TRIM(full_name), ' '), 1) = 3;

-- Caso 4 palabras: 2 nombres + 2 apellidos
UPDATE claims_participants
SET
  first_name = split_part(full_name, ' ', 1) || ' ' || split_part(full_name, ' ', 2),
  last_name = split_part(full_name, ' ', 3) || ' ' || split_part(full_name, ' ', 4),
  updated_at = NOW()
WHERE rut IS NOT NULL AND TRIM(rut) <> ''
  AND rut LIKE '%-%'
  AND rut NOT LIKE '%.%'
  AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\D', '', 'g'), '')::bigint < 50000000
  AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
  AND full_name IS NOT NULL AND TRIM(full_name) <> ''
  AND array_length(string_to_array(TRIM(full_name), ' '), 1) = 4;

-- Caso 5 palabras: 3 nombres + 2 apellidos
UPDATE claims_participants
SET
  first_name = split_part(full_name, ' ', 1) || ' ' || split_part(full_name, ' ', 2) || ' ' || split_part(full_name, ' ', 3),
  last_name = split_part(full_name, ' ', 4) || ' ' || split_part(full_name, ' ', 5),
  updated_at = NOW()
WHERE rut IS NOT NULL AND TRIM(rut) <> ''
  AND rut LIKE '%-%'
  AND rut NOT LIKE '%.%'
  AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\D', '', 'g'), '')::bigint < 50000000
  AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
  AND full_name IS NOT NULL AND TRIM(full_name) <> ''
  AND array_length(string_to_array(TRIM(full_name), ' '), 1) = 5;

-- Caso 6 palabras: 4 nombres + 2 apellidos
UPDATE claims_participants
SET
  first_name = split_part(full_name, ' ', 1) || ' ' || split_part(full_name, ' ', 2) || ' ' || split_part(full_name, ' ', 3) || ' ' || split_part(full_name, ' ', 4),
  last_name = split_part(full_name, ' ', 5) || ' ' || split_part(full_name, ' ', 6),
  updated_at = NOW()
WHERE rut IS NOT NULL AND TRIM(rut) <> ''
  AND rut LIKE '%-%'
  AND rut NOT LIKE '%.%'
  AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\D', '', 'g'), '')::bigint < 50000000
  AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
  AND full_name IS NOT NULL AND TRIM(full_name) <> ''
  AND array_length(string_to_array(TRIM(full_name), ' '), 1) = 6;
