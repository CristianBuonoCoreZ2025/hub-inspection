-- Migración: crear tabla webrtc_stats para monitoreo de videollamadas
-- Permite ver el estado de calidad de todas las llamadas activas

CREATE TABLE IF NOT EXISTS public.webrtc_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL,
  outbound_bitrate integer DEFAULT 0,
  inbound_bitrate integer DEFAULT 0,
  packet_loss_pct integer DEFAULT 0,
  jitter_ms integer DEFAULT 0,
  rtt_ms integer DEFAULT 0,
  ice_candidate_type text DEFAULT 'unknown',
  connection_state text DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar stats por sesión
CREATE INDEX IF NOT EXISTS idx_webrtc_stats_session_id ON public.webrtc_stats (session_id, created_at DESC);

-- RLS: solo usuarios autenticados pueden leer sus stats
ALTER TABLE public.webrtc_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_stats FORCE ROW LEVEL SECURITY;

-- Lectura: usuarios autenticados pueden ver stats de cualquier sesión
CREATE POLICY "webrtc_stats_read" ON public.webrtc_stats
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Escritura: solo service role (API route) puede insertar
CREATE POLICY "webrtc_stats_write" ON public.webrtc_stats
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Auto-cleanup: stats > 24h se pueden borrar (via cron o manualmente)
-- No creamos política DELETE para evitar borrado accidental
