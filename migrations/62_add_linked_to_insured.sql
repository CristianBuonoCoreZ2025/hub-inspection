-- Add linked_to_insured column to claims_participants
-- Persists whether a contractor/beneficiary is linked to the insured data
ALTER TABLE claims_participants
ADD COLUMN IF NOT EXISTS linked_to_insured boolean NOT NULL DEFAULT false;

-- Backfill: set linked_to_insured = true for existing contractor/beneficiary
-- that have identical data to their insured counterpart
UPDATE claims_participants cp
SET linked_to_insured = true
WHERE cp.type IN ('contractor', 'beneficiary')
  AND cp.full_name IS NOT NULL
  AND cp.full_name <> ''
  AND EXISTS (
    SELECT 1
    FROM claims_participants ins
    WHERE ins.claim_id = cp.claim_id
      AND ins.type = 'insured'
      AND COALESCE(ins.first_name, '') = COALESCE(cp.first_name, '')
      AND COALESCE(ins.last_name, '') = COALESCE(cp.last_name, '')
      AND COALESCE(ins.rut, '') = COALESCE(cp.rut, '')
      AND COALESCE(ins.email, '') = COALESCE(cp.email, '')
      AND COALESCE(ins.address, '') = COALESCE(cp.address, '')
  );
