-- ============================================================
-- Hub Inspections — Migracion 22: Eliminar tabla claim_type_causes
-- Se deja solo claim_causes (Causas Siniestro)
-- ============================================================

DROP TABLE IF EXISTS claim_type_causes CASCADE;
