-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 70: Add missing FK constraints for claim_actions system
-- ═══════════════════════════════════════════════════════════════

-- 1. FKs para claim_actions → lookup_catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'claim_actions_action_type_id_fkey'
    AND conrelid = 'public.claim_actions'::regclass
  ) THEN
    ALTER TABLE claim_actions
      ADD CONSTRAINT claim_actions_action_type_id_fkey
      FOREIGN KEY (action_type_id) REFERENCES lookup_catalog(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'claim_actions_action_status_id_fkey'
    AND conrelid = 'public.claim_actions'::regclass
  ) THEN
    ALTER TABLE claim_actions
      ADD CONSTRAINT claim_actions_action_status_id_fkey
      FOREIGN KEY (action_status_id) REFERENCES lookup_catalog(id) ON DELETE SET NULL;
  END IF;
  
  -- line_business_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'claim_actions_line_business_id_fkey'
    AND conrelid = 'public.claim_actions'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_lines' AND table_schema = 'public') THEN
      ALTER TABLE claim_actions
        ADD CONSTRAINT claim_actions_line_business_id_fkey
        FOREIGN KEY (line_business_id) REFERENCES business_lines(id) ON DELETE SET NULL;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lineas_negocio' AND table_schema = 'public') THEN
      ALTER TABLE claim_actions
        ADD CONSTRAINT claim_actions_line_business_id_fkey
        FOREIGN KEY (line_business_id) REFERENCES lineas_negocio(id) ON DELETE SET NULL;
    END IF;
  END IF;
END$$;

-- 2. FKs para action_template
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'action_template_action_type_id_fkey'
    AND conrelid = 'public.action_template'::regclass
  ) THEN
    ALTER TABLE action_template
      ADD CONSTRAINT action_template_action_type_id_fkey
      FOREIGN KEY (action_type_id) REFERENCES lookup_catalog(id) ON DELETE RESTRICT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'action_template_line_business_id_fkey'
    AND conrelid = 'public.action_template'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_lines' AND table_schema = 'public') THEN
      ALTER TABLE action_template
        ADD CONSTRAINT action_template_line_business_id_fkey
        FOREIGN KEY (line_business_id) REFERENCES business_lines(id) ON DELETE SET NULL;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lineas_negocio' AND table_schema = 'public') THEN
      ALTER TABLE action_template
        ADD CONSTRAINT action_template_line_business_id_fkey
        FOREIGN KEY (line_business_id) REFERENCES lineas_negocio(id) ON DELETE SET NULL;
    END IF;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'action_template_company_id_fkey'
    AND conrelid = 'public.action_template'::regclass
  ) THEN
    ALTER TABLE action_template
      ADD CONSTRAINT action_template_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'action_template_event_id_fkey'
    AND conrelid = 'public.action_template'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events' AND table_schema = 'public') THEN
      ALTER TABLE action_template
        ADD CONSTRAINT action_template_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'eventos' AND table_schema = 'public') THEN
      ALTER TABLE action_template
        ADD CONSTRAINT action_template_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES eventos(id) ON DELETE SET NULL;
    END IF;
  END IF;
END$$;

-- 3. FKs para action_template_claim_status (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'action_template_claim_status' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'atcs_action_template_id_fkey'
      AND conrelid = 'public.action_template_claim_status'::regclass
    ) THEN
      ALTER TABLE action_template_claim_status
        ADD CONSTRAINT atcs_action_template_id_fkey
        FOREIGN KEY (action_template_id) REFERENCES action_template(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'atcs_claim_status_id_fkey'
      AND conrelid = 'public.action_template_claim_status'::regclass
    ) THEN
      ALTER TABLE action_template_claim_status
        ADD CONSTRAINT atcs_claim_status_id_fkey
        FOREIGN KEY (claim_status_id) REFERENCES lookup_catalog(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;
