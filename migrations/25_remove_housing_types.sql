-- ============================================================
-- Hub Inspections — Migracion 25: Eliminar tabla housing_types
-- Se deja solo property_classifications (Clasificacion del Bien)
-- ============================================================

DROP TABLE IF EXISTS housing_types CASCADE;
