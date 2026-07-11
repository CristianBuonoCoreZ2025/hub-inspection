-- Migration 127: Add missing FKs for PostgREST resource embedding
-- These FKs are required for PostgREST to resolve relationships in embedding queries.

-- claim_actions: profile ref columns missing FKs
ALTER TABLE public.claim_actions
  ADD CONSTRAINT claim_actions_issuer_id_fkey
  FOREIGN KEY (issuer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.claim_actions
  ADD CONSTRAINT claim_actions_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.claim_actions
  ADD CONSTRAINT claim_actions_approver_id_fkey
  FOREIGN KEY (approver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.claim_actions
  ADD CONSTRAINT claim_actions_dispatcher_id_fkey
  FOREIGN KEY (dispatcher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- action_features: screen_id -> gestion_screens.id
ALTER TABLE public.action_features
  ADD CONSTRAINT action_features_screen_id_fkey
  FOREIGN KEY (screen_id) REFERENCES public.gestion_screens(id) ON DELETE SET NULL;
