-- ============================================================
-- Migracion 55: Fix inspection schema
--
-- Arregla 4 problemas criticos del modulo de inspeccion:
-- 1. inspection_sessions: agregar 'scheduled' al CHECK de status
-- 2. inspection_evidences: renombrar file_url->url, file_type->type, agregar description, claim_id nullable
-- 3. inspection_signatures: renombrar signature_data->signature_url, signer_role->role
-- 4. inspection_reports: agregar status
-- ============================================================

-- 1. inspection_sessions: agregar 'scheduled' al CHECK
ALTER TABLE inspection_sessions DROP CONSTRAINT IF EXISTS inspection_sessions_status_check;
ALTER TABLE inspection_sessions ADD CONSTRAINT inspection_sessions_status_check
  CHECK (status IN ('pending','scheduled','active','completed','cancelled'));

-- 2. inspection_evidences: renombrar campos + agregar description
ALTER TABLE inspection_evidences RENAME COLUMN file_url TO url;
ALTER TABLE inspection_evidences RENAME COLUMN file_type TO type;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE inspection_evidences ALTER COLUMN claim_id DROP NOT NULL;

-- 3. inspection_signatures: renombrar campos
ALTER TABLE inspection_signatures RENAME COLUMN signature_data TO signature_url;
ALTER TABLE inspection_signatures RENAME COLUMN signer_role TO role;

-- 4. inspection_reports: agregar status
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE inspection_reports DROP CONSTRAINT IF EXISTS inspection_reports_status_check;
ALTER TABLE inspection_reports ADD CONSTRAINT inspection_reports_status_check
  CHECK (status IN ('draft','generated','sent'));

-- 5. Verificacion
DO $$
BEGIN
  RAISE NOTICE 'Migracion 55: inspection schema fixed';
  RAISE NOTICE '  - inspection_sessions: scheduled agregado al CHECK';
  RAISE NOTICE '  - inspection_evidences: file_url->url, file_type->type, +description, claim_id nullable';
  RAISE NOTICE '  - inspection_signatures: signature_data->signature_url, signer_role->role';
  RAISE NOTICE '  - inspection_reports: +status (draft/generated/sent)';
END $$;
