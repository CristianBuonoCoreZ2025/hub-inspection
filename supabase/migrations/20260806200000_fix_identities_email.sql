-- Fix: auth.identities.email is GENERATED ALWAYS but GoTrue tries to INSERT into it
-- This breaks ALL user creation (admin, invite, signup)
ALTER TABLE auth.identities ALTER COLUMN email DROP EXPRESSION;

-- Restore emails from identity_data
UPDATE auth.identities
SET email = lower(identity_data->>'email')
WHERE identity_data->>'email' IS NOT NULL;

-- Create trigger to auto-populate email from identity_data
CREATE OR REPLACE FUNCTION auth.populate_identity_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NULL AND NEW.identity_data->>'email' IS NOT NULL THEN
    NEW.email := lower(NEW.identity_data->>'email');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_populate_identity_email ON auth.identities;
CREATE TRIGGER trg_populate_identity_email
  BEFORE INSERT OR UPDATE ON auth.identities
  FOR EACH ROW EXECUTE FUNCTION auth.populate_identity_email();
