-- ═══════════════════════════════════════════════════════════════════
-- Migración 259: Seed de colores por defecto en characteristic
-- ═══════════════════════════════════════════════════════════════════
-- Puebla la columna `color` (agregada en migración 258) con los colores
-- por defecto que estaban hardcoded en el frontend (GESTION_COLORS).
-- Así los colores quedan por configuración en la BD, no en duro en el código.
--
-- Relación: characteristic.action_feature_id → action_features.id → action_features.code
-- ═══════════════════════════════════════════════════════════════════

-- Actualizar el color de la primera characteristic de cada action_feature
-- según el código del feature. Solo actualiza si color es NULL (no sobrescribe
-- colores ya configurados manualmente por el usuario).

UPDATE characteristic c
SET color = sub.color
FROM (
  SELECT
    ch.id AS characteristic_id,
    af.code AS feature_code,
    CASE af.code
      WHEN 'COB' THEN '#3b82f6'  -- blue-500
      WHEN 'RES' THEN '#f59e0b'  -- amber-500
      WHEN 'PCA' THEN '#06b6d4'  -- cyan-500
      WHEN 'AJU' THEN '#8b5cf6'  -- violet-500
      WHEN 'CIN' THEN '#10b981'  -- emerald-500
      WHEN 'INS' THEN '#d946ef'  -- fuchsia-500
      WHEN 'SOL' THEN '#0ea5e9'  -- sky-500
      WHEN 'RTA' THEN '#14b8a6'  -- teal-500
      WHEN 'CIE' THEN '#f43f5e'  -- rose-500
      WHEN 'REA' THEN '#6366f1'  -- indigo-500
      WHEN 'PRO' THEN '#f97316'  -- orange-500
      WHEN 'IMP' THEN '#84cc16'  -- lime-500
      WHEN 'RIN' THEN '#ec4899'  -- pink-500
      ELSE NULL
    END AS color
  FROM characteristic ch
  JOIN action_features af ON af.id = ch.action_feature_id
  WHERE af.code IN ('COB','RES','PCA','AJU','CIN','INS','SOL','RTA','CIE','REA','PRO','IMP','RIN')
    AND ch.color IS NULL
    -- Solo la primera characteristic por feature (la que se usa en la grilla)
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
