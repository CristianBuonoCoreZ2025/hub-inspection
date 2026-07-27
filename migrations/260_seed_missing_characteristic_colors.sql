-- ═══════════════════════════════════════════════════════════════════
-- Migración 260: Seed de colores para características faltantes
-- ═══════════════════════════════════════════════════════════════════
-- Completa los colores de características que no fueron cubiertas en la
-- migración 259 (ADD, AJU, CEA, RPA, RPR, DES).
-- ═══════════════════════════════════════════════════════════════════

UPDATE characteristic c
SET color = sub.color
FROM (
  SELECT
    ch.id AS characteristic_id,
    af.code AS feature_code,
    CASE af.code
      WHEN 'ADD' THEN '#7c3aed'  -- violet-600 (addendum)
      WHEN 'AJU' THEN '#8b5cf6'  -- violet-500 (ajuste)
      WHEN 'CEA' THEN '#0d9488'  -- teal-600 (contacto email)
      WHEN 'RPA' THEN '#a16207'  -- amber-700 (prórroga)
      WHEN 'RPR' THEN '#dc2626'  -- red-600 (reporte preliminar)
      WHEN 'DES' THEN '#0891b2'  -- cyan-600 (despacho)
      ELSE NULL
    END AS color
  FROM characteristic ch
  JOIN action_features af ON af.id = ch.action_feature_id
  WHERE af.code IN ('ADD','AJU','CEA','RPA','RPR','DES')
    AND ch.color IS NULL
    -- Solo la primera characteristic por feature
    AND ch.id = (
      SELECT c2.id
      FROM characteristic c2
      WHERE c2.action_feature_id = ch.action_feature_id
        AND c2.is_active = true
      ORDER BY c2.sort_order ASC, c2.created_at ASC
      LIMIT 1
    )
) sub
WHERE c.id = sub.characteristic_id
  AND c.color IS NULL;
