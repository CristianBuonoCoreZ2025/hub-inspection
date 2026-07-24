-- ═══════════════════════════════════════════════════════════════
-- Migration 215: eliminar políticas viejas abiertas de inspection_sessions
--
-- La migración 214 dejó las políticas *_company creadas por 212.
-- Esta migración las elimina para que solo queden las tenant.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "inspection_sessions_select_company" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_all_company" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_select" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_insert" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_update" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_delete" ON inspection_sessions;
