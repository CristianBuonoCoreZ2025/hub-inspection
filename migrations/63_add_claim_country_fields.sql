-- Drop redundant claim_country/claim_region/claim_city/claim_commune text columns
-- from claims table. country_id, region_id, city_id, commune_id FKs already exist.
ALTER TABLE claims DROP COLUMN IF EXISTS claim_country;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_region;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_city;
ALTER TABLE claims DROP COLUMN IF EXISTS claim_commune;
