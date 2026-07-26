-- ═════════════════════════════════════════════════════════════════
-- Migration 250: query_audit_log — log de auditoría de consultas
--
-- Registra cada consulta a Supabase (tabla, operación, duración, éxito/error)
-- para identificar las más lentas y optimizarlas.
--
-- Es una tabla de telemetría: se escribe desde el cliente (con RLS que
-- permite INSERT a cualquier usuario autenticado) y se lee solo desde
-- el panel de admin / server actions.
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS query_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Contexto de la consulta
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,                    -- select_one | select_all | insert | update | delete | rpc
  duration_ms INTEGER NOT NULL,               -- duración en milisegundos
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  -- Contexto del usuario/sesión
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,                            -- ID de sesión anónimo (random por tab)
  route TEXT,                                 -- ruta de la página donde se ejecutó
  -- Metadata adicional
  rows_affected INTEGER,
  query_size TEXT,                            -- 'small' | 'medium' | 'large' (heuristic)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para análisis
CREATE INDEX IF NOT EXISTS idx_query_audit_log_created_at
  ON query_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_table_op
  ON query_audit_log (table_name, operation);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_duration
  ON query_audit_log (duration_ms DESC)
  WHERE duration_ms > 500;
CREATE INDEX IF NOT EXISTS idx_query_audit_log_user
  ON query_audit_log (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- RLS: permitir INSERT a cualquier usuario autenticado (para telemetría)
-- y SELECT solo a admins (server actions con service role).
ALTER TABLE query_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "query_audit_log_insert_authenticated" ON query_audit_log;
CREATE POLICY "query_audit_log_insert_authenticated" ON query_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Permitir INSERT anónimo también (algunas mediciones ocurren antes de auth)
DROP POLICY IF EXISTS "query_audit_log_insert_anon" ON query_audit_log;
CREATE POLICY "query_audit_log_insert_anon" ON query_audit_log
  FOR INSERT TO anon WITH CHECK (true);

-- SELECT: bloquear desde el cliente. Solo server actions con service role
-- pueden leer (bypass RLS).
DROP POLICY IF EXISTS "query_audit_log_select" ON query_audit_log;
CREATE POLICY "query_audit_log_select" ON query_audit_log
  FOR SELECT TO authenticated USING (false);

-- DELETE: solo para limpieza administrativa vía server action (service role)
-- No se expone DELETE desde el cliente.

-- Trigger para auto-purgar registros > 30 días (mantener tamaño bajo)
CREATE OR REPLACE FUNCTION purge_old_query_audit_log()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM query_audit_log
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;
