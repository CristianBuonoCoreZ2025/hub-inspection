-- Tabla para eventos de WebRTC (peer_join, peer_leave, ice_restart, kick, etc.)
-- Permite trazabilidad completa de cada videollamada
CREATE TABLE IF NOT EXISTS public.webrtc_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.inspection_sessions(id) ON DELETE CASCADE,
  claim_id UUID,
  user_id TEXT,
  role TEXT NOT NULL DEFAULT 'unknown',
  event_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_webrtc_events_session_id ON public.webrtc_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webrtc_events_claim_id ON public.webrtc_events(claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webrtc_events_event_type ON public.webrtc_events(event_type);

-- RLS: authenticated puede leer (para dashboard), solo service_role puede escribir
ALTER TABLE public.webrtc_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webrtc_events_read_authenticated"
  ON public.webrtc_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "webrtc_events_write_service_role"
  ON public.webrtc_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permitir INSERT anónimo via magic link token (validado en la API route)
-- No podemos validar el token en RLS, así que el INSERT se hace via service_role en la API
