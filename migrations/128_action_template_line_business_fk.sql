-- Migration 128: Add missing FK from action_template.line_business_id to business_lines.id
ALTER TABLE public.action_template DROP CONSTRAINT IF EXISTS action_template_line_business_id_fkey;
ALTER TABLE public.action_template
  ADD CONSTRAINT action_template_line_business_id_fkey
  FOREIGN KEY (line_business_id) REFERENCES public.business_lines(id) ON DELETE SET NULL;
