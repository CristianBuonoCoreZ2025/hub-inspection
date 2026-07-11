-- Migration 126: Add missing FKs required for PostgREST resource embedding
-- These FKs are required for PostgREST resource embedding to work in claims.ts and claim-actions.ts queries.

-- 1. action_template_claim_status.claim_status_id -> lookup_catalog.id
ALTER TABLE public.action_template_claim_status
  ADD CONSTRAINT action_template_claim_status_claim_status_id_fkey
  FOREIGN KEY (claim_status_id) REFERENCES public.lookup_catalog(id) ON DELETE CASCADE;

-- 2. action_template.action_type_id -> lookup_catalog.id
ALTER TABLE public.action_template
  ADD CONSTRAINT action_template_action_type_id_fkey
  FOREIGN KEY (action_type_id) REFERENCES public.lookup_catalog(id) ON DELETE RESTRICT;
