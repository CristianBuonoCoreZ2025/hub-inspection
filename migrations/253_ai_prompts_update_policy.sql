-- ═══════════════════════════════════════════════════════════════
-- Migración 253: Política UPDATE para ai_prompts
-- La migración 250 solo creó SELECT para authenticated.
-- Sin política UPDATE, el browser no puede editar prompts
-- (RLS bloquea silenciosamente → 0 filas → .single() falla).
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY ai_prompts_update ON ai_prompts
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
