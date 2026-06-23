-- Migration 44: Remove sw_type from claim_types table
-- Icon field remains for storing the selected icon name

ALTER TABLE claim_types DROP COLUMN IF EXISTS sw_type;
