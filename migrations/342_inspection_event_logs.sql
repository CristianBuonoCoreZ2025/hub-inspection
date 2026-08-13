-- ═══════════════════════════════════════════════════════════════
-- 342: Tabla de logs de eventos de inspección
--
-- Registra TODOS los eventos que ocurren durante una inspección:
--   - Foto tomada (cámara directa o modal)
--   - Video grabado (cámara directa o modal)
--   - Upload iniciado / completado / fallido
--   - Evidencia eliminada
--   - Geo capturada / recaptura habilitada
--   - Videollamada iniciada / finalizada
--   - Screenshot tomada
--
-- Similar a magic_link_connection_logs pero para eventos de la sesión.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inspection_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,

  -- Quién y desde dónde
  role TEXT NOT NULL DEFAULT 'adjuster', -- 'adjuster' | 'insured' | 'system'
  actor_name TEXT, -- nombre del usuario (para insured sin auth)

  -- Tipo de evento
  event_type TEXT NOT NULL, -- 'photo_taken' | 'video_recorded' | 'upload_started' | 'upload_completed' | 'upload_failed' | 'evidence_deleted' | 'geo_captured' | 'geo_recapture_enabled' | 'video_call_started' | 'video_call_ended' | 'screenshot_taken' | 'recording_saved'
  event_detail TEXT, -- descripción legible: "Foto subida: L-000000141-HINS-001-EVI-0001.jpg"
  evidence_id UUID, -- si el evento está asociado a una evidencia específica

  -- Metadata del dispositivo (mismo patrón que connection_logs)
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'mobile' | 'tablet' | 'desktop'
  browser TEXT,
  os TEXT,

  -- Metadata adicional flexible (tamaño archivo, duración video, etc.)
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inspection_event_logs_session_id ON inspection_event_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_inspection_event_logs_created_at ON inspection_event_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_event_logs_event_type ON inspection_event_logs(event_type);

-- RLS
ALTER TABLE inspection_event_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: usuarios autenticados de la misma empresa (via session → claim → company)
CREATE POLICY "inspection_event_logs_select" ON inspection_event_logs
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM inspection_sessions s
      JOIN claims c ON s.claim_id = c.id
      JOIN profiles p ON p.company_id = c.company_id
      WHERE p.user_id = auth.uid()
    )
  );

-- INSERT: usuarios autenticados de la misma empresa O magic link anónimo
-- (el magic link se valida en la API route, no en RLS — usamos service role)
CREATE POLICY "inspection_event_logs_insert" ON inspection_event_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM inspection_sessions s
      JOIN claims c ON s.claim_id = c.id
      JOIN profiles p ON p.company_id = c.company_id
      WHERE p.user_id = auth.uid()
    )
  );

-- DELETE: no se borran logs (auditoría)
-- UPDATE: no se actualizan logs (auditoría)

-- Comentario
COMMENT ON TABLE inspection_event_logs IS 'Log de auditoría de eventos durante inspecciones (fotos, videos, uploads, geo, videollamada)';
