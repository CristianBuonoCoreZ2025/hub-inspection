-- ═══════════════════════════════════════════════════════════════
-- DIAGNÓSTICO DE persons (SOLO LECTURA)
-- No modifica ningún dato. Solo SELECT.
-- ═══════════════════════════════════════════════════════════════

\echo '=== 1. Total de personas ==='
SELECT COUNT(*) AS total FROM persons;

\echo ''
\echo '=== 2. Total de direcciones ==='
SELECT COUNT(*) AS total FROM person_addresses;

\echo ''
\echo '=== 3. Duplicados por tax_id ==='
SELECT tax_id, COUNT(*) AS cnt
FROM persons
WHERE tax_id IS NOT NULL AND tax_id != ''
GROUP BY tax_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

\echo ''
\echo '=== 4. Duplicados por country_id + tax_id ==='
SELECT country_id, tax_id, COUNT(*) AS cnt
FROM persons
WHERE tax_id IS NOT NULL AND tax_id != ''
GROUP BY country_id, tax_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

\echo ''
\echo '=== 5. Nulos en campos clave ==='
SELECT
  COUNT(*) FILTER (WHERE tax_id IS NULL OR tax_id = '') AS tax_id_null,
  COUNT(*) FILTER (WHERE first_name IS NULL OR first_name = '') AS first_name_null,
  COUNT(*) FILTER (WHERE last_name IS NULL OR last_name = '') AS last_name_null,
  COUNT(*) FILTER (WHERE business_name IS NULL OR business_name = '') AS business_name_null,
  COUNT(*) FILTER (WHERE country_id IS NULL) AS country_id_null
FROM persons;

\echo ''
\echo '=== 6. Distribución por person_type ==='
SELECT person_type, COUNT(*) AS cnt
FROM persons
GROUP BY person_type
ORDER BY cnt DESC;

\echo ''
\echo '=== 7. tax_id con formato inconsistente ==='
SELECT id, tax_id, first_name, last_name, person_type
FROM persons
WHERE tax_id ~ '[\.\s-]' OR tax_id !~ '^[0-9Kk]+$'
ORDER BY tax_id;

\echo ''
\echo '=== 8. Personas sin ningún nombre ==='
SELECT id, tax_id, person_type
FROM persons
WHERE (first_name IS NULL OR first_name = '')
  AND (last_name IS NULL OR last_name = '')
  AND (business_name IS NULL OR business_name = '')
ORDER BY tax_id;

\echo ''
\echo '=== 9. Personas naturales incompletas (sin first_name o last_name) ==='
SELECT id, tax_id, first_name, last_name
FROM persons
WHERE person_type = 'natural'
  AND (first_name IS NULL OR first_name = '' OR last_name IS NULL OR last_name = '')
ORDER BY tax_id;

\echo ''
\echo '=== 10. Personas jurídicas sin business_name ==='
SELECT id, tax_id, first_name, last_name
FROM persons
WHERE person_type = 'legal'
  AND (business_name IS NULL OR business_name = '')
ORDER BY tax_id;

\echo ''
\echo '=== 11. RUT >= 50.000.000 marcados como natural (posible error) ==='
SELECT id, tax_id, person_type, first_name, last_name, business_name
FROM persons
WHERE person_type = 'natural'
  AND tax_id IS NOT NULL AND tax_id != ''
  AND NULLIF(REGEXP_REPLACE(tax_id, '[^0-9]', '', 'g'), '')::bigint >= 50000000
ORDER BY tax_id;

\echo ''
\echo '=== 12. RUT < 50.000.000 marcados como legal (posible error) ==='
SELECT id, tax_id, person_type, first_name, last_name, business_name
FROM persons
WHERE person_type = 'legal'
  AND tax_id IS NOT NULL AND tax_id != ''
  AND NULLIF(REGEXP_REPLACE(tax_id, '[^0-9]', '', 'g'), '')::bigint < 50000000
  AND NULLIF(REGEXP_REPLACE(tax_id, '[^0-9]', '', 'g'), '')::bigint > 0
ORDER BY tax_id;

\echo ''
\echo '=== 13. Personas con direcciones (top 20) ==='
SELECT p.id, p.tax_id,
  COALESCE(p.business_name, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), '(sin nombre)') AS nombre,
  COUNT(pa.id) AS addr_count
FROM persons p
LEFT JOIN person_addresses pa ON pa.person_id = p.id
GROUP BY p.id, p.tax_id, p.business_name, p.first_name, p.last_name
HAVING COUNT(pa.id) > 0
ORDER BY addr_count DESC
LIMIT 20;

\echo ''
\echo '=== 14. Muestra de últimos 20 registros ==='
SELECT id, country_id, tax_id, person_type, first_name, last_name, business_name, created_at
FROM persons
ORDER BY created_at DESC
LIMIT 20;
