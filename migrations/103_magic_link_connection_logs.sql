-- ═══════════════════════════════════════════════════════════════
-- Migración 103 — Logs de conexión del magic link
-- ═══════════════════════════════════════════════════════════════
--
-- Registra cada intento de conexión al magic link (inspector y cliente):
--   - IP, ubicación geográfica (país, región, ciudad)
--   - Tipo de dispositivo, navegador, sistema operativo
--   - Permisos de cámara y micrófono (concedido/denegado/error)
--   - Estado de la conexión (success, failed, retry, disconnected)
--   - Rol (insured, adjuster, supervisor)
--   - Timestamps de conexión y desconexión
--   - Motivo de desconexión si aplica
--
-- Accesible desde la inspección para auditoría.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS magic_link_connection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,

  -- Quién se conecta
  role TEXT NOT NULL CHECK (role IN ('insured', 'adjuster', 'supervisor')),
  user_identifier TEXT,

  -- Datos de red
  ip_address TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,

  -- Datos del dispositivo
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,

  -- Permisos de media
  camera_permission TEXT CHECK (camera_permission IN ('granted', 'denied', 'error', 'not_requested')),
  microphone_permission TEXT CHECK (microphone_permission IN ('granted', 'denied', 'error', 'not_requested')),

  -- Estado de la conexión
  status TEXT NOT NULL CHECK (status IN ('connecting', 'success', 'failed', 'retry', 'disconnected', 'kicked')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  disconnect_reason TEXT,

  -- Timestamps
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mlcl_session_id ON magic_link_connection_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_mlcl_claim_id ON magic_link_connection_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_mlcl_role ON magic_link_connection_logs(role);
CREATE INDEX IF NOT EXISTS idx_mlcl_status ON magic_link_connection_logs(status);
CREATE INDEX IF NOT EXISTS idx_mlcl_connected_at ON magic_link_connection_logs(connected_at DESC);

-- RLS
ALTER TABLE magic_link_connection_logs ENABLE ROW LEVEL SECURITY;

-- Policy: acceso basado en el tenant de la sesión
CREATE OR REPLACE FUNCTION is_mlcl_tenant_allowed(p_log_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
  SELECT is_session_tenant_allowed(session_id)
  FROM magic_link_connection_logs
  WHERE id = p_log_id;
$$;

CREATE POLICY magic_link_connection_logs_tenant_select
  ON magic_link_connection_logs FOR SELECT TO public
  USING (is_session_tenant_allowed(session_id));

CREATE POLICY magic_link_connection_logs_tenant_insert
  ON magic_link_connection_logs FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY magic_link_connection_logs_tenant_update
  ON magic_link_connection_logs FOR UPDATE TO public
  USING (is_session_tenant_allowed(session_id))
  WITH CHECK (is_session_tenant_allowed(session_id));

CREATE POLICY magic_link_connection_logs_tenant_delete
  ON magic_link_connection_logs FOR DELETE TO public
  USING (is_session_tenant_allowed(session_id));

-- Grant
GRANT SELECT, INSERT, UPDATE, DELETE ON magic_link_connection_logs TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_mlcl_tenant_allowed(uuid) TO authenticated, anon;

INSERT INTO _migrations (filename) VALUES ('103_magic_link_connection_logs.sql')
ON CONFLICT (filename) DO NOTHING;
