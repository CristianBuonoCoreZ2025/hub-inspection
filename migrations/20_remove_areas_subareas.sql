-- ============================================================
-- Hub Inspections — Migracion 20: Eliminar areas y subareas
-- Se eliminan catalogos no utilizados
-- ============================================================

DROP TABLE IF EXISTS subareas CASCADE;
DROP TABLE IF EXISTS areas CASCADE;
