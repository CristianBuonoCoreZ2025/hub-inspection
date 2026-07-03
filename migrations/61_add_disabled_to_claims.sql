-- Migration 61: Add disabled fields to claims
-- Permite inhabilitar siniestros con motivo (operación especial, no eliminación física)
-- Los siniestros inhabilitados se gestionan desde /dashboard/operaciones

ALTER TABLE claims ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS disabled_reason TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS disabled_by UUID;
