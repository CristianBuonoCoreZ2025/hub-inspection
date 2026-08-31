-- ═══════════════════════════════════════════════════════════════════
-- Migración 100: Desactivar siniestros duplicados por client_reference
-- ═══════════════════════════════════════════════════════════════════
--
-- PROBLEMA: Hay 121 grupos de siniestros duplicados (mismo client_reference
-- + company_id, ambos vigentes). Total: 243 claims involucrados.
--
-- CRITERIO DE DECISIÓN (cuál mantener vigente):
--   1. El que tiene inspección (prioridad máxima — la inspección manda)
--   2. Si ambos tienen gestiones: el que tiene más gestiones activas
--   3. Si ninguno tiene actividad: el de menor número de liquidación
--
-- RESULTADO:
--   - 121 claims se MANTIENEN vigentes (disabled = false)
--   - 122 claims se DESACTIVAN (disabled = true)
--   - 0 claims a desactivar tienen inspección (todas las inspecciones
--     están en los claims que se mantienen)
--   - 120 gestiones activas quedan en claims desactivados (NO se borran,
--     quedan en la BD pero inaccesibles desde la UI)
--   - 150 participantes quedan en claims desactivados (NO se borran)
--
-- ⚠️ NO SE BORRAN DATOS. Solo se marca disabled = true.
--    Los claims desactivados se pueden reactivar con disabled = false.
--
-- FECHA: 2026-08-21
-- ═══════════════════════════════════════════════════════════════════

-- ── Tabla temporal con el análisis de duplicados ──
-- Calcula qué claims mantener (rn=1) y cuáles desactivar (rn>1)

WITH dupes AS (
  SELECT client_reference, company_id
  FROM claims
  WHERE disabled = false
    AND client_reference IS NOT NULL
    AND client_reference <> ''
  GROUP BY client_reference, company_id
  HAVING count(*) > 1
),
ranked AS (
  SELECT
    c.id,
    c.client_reference,
    c.company_id,
    c.liquidation_number,
    ROW_NUMBER() OVER (
      PARTITION BY c.client_reference, c.company_id
      ORDER BY
        -- 1. Prioridad: tiene inspección
        (COALESCE(ins.it, 0) > 0) DESC,
        -- 2. Prioridad: tiene gestiones activas
        (COALESCE(ca.ga, 0) > 0) DESC,
        -- 3. Más gestiones activas gana
        COALESCE(ca.ga, 0) DESC,
        -- 4. Menor número de liquidación
        c.liquidation_number ASC NULLS LAST,
        -- 5. Más antiguo (created_at)
        c.created_at ASC
    ) AS rn
  FROM claims c
  JOIN dupes d
    ON c.client_reference = d.client_reference
   AND c.company_id = d.company_id
  LEFT JOIN (
    SELECT claim_id,
           count(*) FILTER (WHERE is_active = true) AS ga
    FROM claim_actions
    GROUP BY claim_id
  ) ca ON ca.claim_id = c.id
  LEFT JOIN (
    SELECT claim_id, count(*) AS it
    FROM inspection_sessions
    GROUP BY claim_id
  ) ins ON ins.claim_id = c.id
  WHERE c.disabled = false
),
to_disable AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE claims
SET
  disabled = true,
  disabled_reason = 'Siniestro duplicado por client_reference — desactivado automaticamente (migracion 100)',
  disabled_at = now()
WHERE id IN (SELECT id FROM to_disable);

-- ── Verificación: contar resultado ──
-- Después de ejecutar, correr esta query para verificar:
--
-- SELECT
--   count(*) FILTER (WHERE disabled = false) AS vigentes,
--   count(*) FILTER (WHERE disabled = true AND disabled_reason LIKE '%migracion 100%') AS desactivados
-- FROM claims
-- WHERE client_reference IN (
--   SELECT client_reference FROM (
--     SELECT client_reference, count(*)
--     FROM claims
--     WHERE client_reference IS NOT NULL AND client_reference <> ''
--     GROUP BY client_reference
--     HAVING count(*) > 1
--   ) x
-- );
