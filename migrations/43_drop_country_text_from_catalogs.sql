-- Migration 43: Remove legacy 'country' TEXT column from catalog tables
-- These tables now use country_id (UUID FK to countries) exclusively.

ALTER TABLE claim_causes DROP COLUMN IF EXISTS country;
ALTER TABLE insurance_companies DROP COLUMN IF EXISTS country;
ALTER TABLE brokers DROP COLUMN IF EXISTS country;
ALTER TABLE advisors DROP COLUMN IF EXISTS country;
ALTER TABLE business_lines DROP COLUMN IF EXISTS country;
ALTER TABLE insurance_products DROP COLUMN IF EXISTS country;
