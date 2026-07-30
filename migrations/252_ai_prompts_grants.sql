-- ═══════════════════════════════════════════════════════════════
-- Migración 252: Grants para ai_prompts
-- La migración 250 creó la tabla con RLS pero sin GRANT a anon,
-- authenticated y service_role. Por eso PostgREST devuelve 403.
-- ═══════════════════════════════════════════════════════════════

-- Permisos para anon (lectura solo, RLS controla el acceso real)
GRANT SELECT ON ai_prompts TO anon;

-- Permisos para authenticated (CRUD, RLS controla qué filas puede ver/modificar)
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_prompts TO authenticated;

-- Permisos para service_role (CRUD completo, bypass RLS)
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ai_prompts TO service_role;
