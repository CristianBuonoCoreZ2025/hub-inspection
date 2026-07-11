-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 81: Add review_levels to action_template
-- Define cuántos niveles de revisión tiene la gestión:
--   0 = sin workflow
--   1 = solo Emisor
--   2 = Emisor + Revisor
--   3 = Emisor + Revisor + Aprobador
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS review_levels integer NOT NULL DEFAULT 1;

-- Migrar datos existentes: derivar review_levels de is_review_applicable e is_approval_applicable
UPDATE action_template
  SET review_levels = CASE
    WHEN is_approval_applicable = true THEN 3
    WHEN is_review_applicable = true THEN 2
    ELSE 1
  END;
