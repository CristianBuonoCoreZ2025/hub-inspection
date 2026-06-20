-- ============================================================
-- Hub Inspections — Migracion 39: Renombrar tablas a nomenclatura plural
-- claim_participants → claims_participants
-- claims_carga → claims_staging
-- ============================================================

-- Renombrar claim_participants → claims_participants
ALTER TABLE claim_participants RENAME TO claims_participants;

-- Renombrar claims_carga → claims_staging
ALTER TABLE claims_carga RENAME TO claims_staging;
