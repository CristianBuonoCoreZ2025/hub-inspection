-- ═══════════════════════════════════════════════════════════════════
-- Migración 352: Campos para inspecciones offline
-- ═══════════════════════════════════════════════════════════════════
-- Permite que un inspector descargue una inspección para trabajar
-- sin conexión. La inspección queda bloqueada (nadie más puede editar)
-- y se registra quién la descargó y cuándo.

-- 1. Campos de descarga offline en inspection_sessions
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS offline_downloaded_at timestamptz;
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS offline_downloaded_by uuid REFERENCES profiles(id);
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS offline_synced_at timestamptz;

-- 2. Índice para buscar inspecciones descargadas offline
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_offline
  ON inspection_sessions (offline_downloaded_by)
  WHERE offline_downloaded_at IS NOT NULL;

-- 3. Comentario documental
COMMENT ON COLUMN inspection_sessions.offline_downloaded_at IS
  'Fecha en que el inspector descargó la inspección para uso offline';
COMMENT ON COLUMN inspection_sessions.offline_downloaded_by IS
  'Profile ID del inspector que descargó la inspección offline';
COMMENT ON COLUMN inspection_sessions.offline_synced_at IS
  'Última fecha de sincronización de la inspección offline con el servidor';
