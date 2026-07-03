-- ═══════════════════════════════════════════════════════════════════
-- Migración 65: Añadir campos de reapertura a claims
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE claims ADD COLUMN IF NOT EXISTS reopened_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reopened_by uuid;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reopened_reason text;
