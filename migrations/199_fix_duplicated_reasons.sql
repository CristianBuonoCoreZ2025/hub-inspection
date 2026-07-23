-- ═══════════════════════════════════════════════════════════════
-- Migration 199: Fix duplicated cancellation_reasons + unique constraint
--
-- Problema: La migración 57 insertó motivos de cancelación duplicados
-- (cada motivo aparece 2 veces con diferente ID pero mismo code).
--
-- Solución:
-- 1. Deduplicar: mantener el registro más antiguo por (category, code),
--    reasignar FKs y borrar los duplicados.
-- 2. Agregar constraint UNIQUE (category, code) para prevenir futuros dups.
-- ═══════════════════════════════════════════════════════════════

-- 1. Reasignar FKs de inspection_sessions al registro más antiguo por (category, code)
WITH keep AS (
  SELECT category, code, (array_agg(id ORDER BY created_at))[1] as keep_id
  FROM lookup_catalog
  WHERE category = 'cancellation_reason'
  GROUP BY category, code
),
dup_ids AS (
  SELECT lc.id FROM lookup_catalog lc
  JOIN keep k ON lc.category = k.category AND lc.code = k.code
  WHERE lc.category = 'cancellation_reason' AND lc.id <> k.keep_id
)
UPDATE inspection_sessions s
SET cancellation_reason_id = k.keep_id
FROM keep k
WHERE s.cancellation_reason_id IN (SELECT id FROM dup_ids)
  AND s.cancellation_reason_id IS NOT NULL;

-- 2. Reasignar FKs de inspection_reports
WITH keep AS (
  SELECT category, code, (array_agg(id ORDER BY created_at))[1] as keep_id
  FROM lookup_catalog
  WHERE category = 'cancellation_reason'
  GROUP BY category, code
),
dup_ids AS (
  SELECT lc.id FROM lookup_catalog lc
  JOIN keep k ON lc.category = k.category AND lc.code = k.code
  WHERE lc.category = 'cancellation_reason' AND lc.id <> k.keep_id
)
UPDATE inspection_reports r
SET cancellation_reason_id = k.keep_id
FROM keep k
WHERE r.cancellation_reason_id IN (SELECT id FROM dup_ids)
  AND r.cancellation_reason_id IS NOT NULL;

-- 3. Borrar duplicados (mantener el más antiguo)
WITH keep AS (
  SELECT (array_agg(id ORDER BY created_at))[1] as keep_id
  FROM lookup_catalog
  WHERE category = 'cancellation_reason'
  GROUP BY category, code
)
DELETE FROM lookup_catalog
WHERE category = 'cancellation_reason'
  AND id NOT IN (SELECT keep_id FROM keep);

-- 4. Constraint único para prevenir futuros duplicados (solo cancellation_reason)
DROP INDEX IF EXISTS lookup_catalog_cancellation_reason_unique;
CREATE UNIQUE INDEX lookup_catalog_cancellation_reason_unique
  ON lookup_catalog (category, code)
  WHERE is_active = true AND category = 'cancellation_reason' AND code IS NOT NULL;

-- 5. Verificación
SELECT category, code, count(*) as n
FROM lookup_catalog
WHERE category = 'cancellation_reason'
GROUP BY category, code
ORDER BY code;
