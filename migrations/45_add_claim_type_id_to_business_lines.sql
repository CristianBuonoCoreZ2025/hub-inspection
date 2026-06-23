-- Migration 45: Add claim_type_id FK to business_lines table
-- This replaces the text claim_type field with a proper relationship to claim_types

ALTER TABLE business_lines ADD COLUMN IF NOT EXISTS claim_type_id UUID REFERENCES claim_types(id) ON DELETE SET NULL;

-- Note: The old claim_type TEXT field remains for now for data migration
-- After verifying data, it can be dropped with: ALTER TABLE business_lines DROP COLUMN claim_type;
