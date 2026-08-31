-- Migración: crear tabla turn_cache para credenciales TURN compartidas
-- entre instancias de Vercel. Evita que cada instancia llame a Cloudflare por separado.

CREATE TABLE IF NOT EXISTS public.turn_cache (
  id text PRIMARY KEY DEFAULT 'singleton',
  ice_servers jsonb NOT NULL,
  expires_at bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: solo service role puede leer/escribir (es cache interno del server)
ALTER TABLE public.turn_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turn_cache FORCE ROW LEVEL SECURITY;

-- Solo service role puede acceder
CREATE POLICY "turn_cache_service_role_only" ON public.turn_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
