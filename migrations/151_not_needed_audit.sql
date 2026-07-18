-- Registrar quién dijo "no necesario", cuándo y por qué
ALTER TABLE claim_document_request_items
  ADD COLUMN IF NOT EXISTS not_needed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS not_needed_at timestamptz;
