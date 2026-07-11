-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 77: Add country_id to action_template
-- Permite filtrar gestiones por país además de compañía y evento
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;

-- Índice para filtrar por país
CREATE INDEX IF NOT EXISTS idx_action_template_country ON action_template(country_id) WHERE country_id IS NOT NULL;
