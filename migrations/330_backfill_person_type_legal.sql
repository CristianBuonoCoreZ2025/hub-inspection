-- ============================================================
-- Hub Inspections — Migracion 330: Backfill person_type legal en claims_participants
--
-- Antecedentes:
--   - claims_participants.person_type tenia default 'natural' y el
--     formulario de siniestros no lo escribia. Todos los participantes
--     juridicos quedaron mal etiquetados como 'natural'.
--   - Este script detecta RUTs chilenos de persona juridica (cuerpo
--     numerico >= 50.000.000) y actualiza person_type a 'legal'.
--
-- Tabla afectada: claims_participants
-- Tipo de cambio: UPDATE (no destructivo)
-- ============================================================

WITH cleaned AS (
  SELECT
    id,
    upper(replace(replace(replace(rut, '.', ''), '-', ''), ' ', '')) AS clean
  FROM claims_participants
  WHERE
    country ILIKE 'Chile'
    AND rut IS NOT NULL
    AND rut <> ''
    AND person_type <> 'legal'
)

UPDATE claims_participants cp
SET person_type = 'legal'
FROM cleaned c
WHERE
  cp.id = c.id
  AND length(c.clean) > 1
  AND substring(c.clean, 1, length(c.clean) - 1)::bigint >= 50000000;

-- Resultado: afecta solo los registros de Chile cuyo RUT (sin DV)
-- corresponde a persona juridica.
