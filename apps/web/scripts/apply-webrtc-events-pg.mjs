import pg from "pg";
import { readFileSync } from "fs";

const env = readFileSync(".env.production", "utf-8");
const connStr = env.match(/DATABASE_URL=(.+)/)[1].trim();

const client = new pg.Client({ connectionString: connStr });

async function main() {
  await client.connect();
  console.log("Conectado a Postgres");

  // Crear tabla
  await client.query(`CREATE TABLE IF NOT EXISTS public.webrtc_events (
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
  )`);
  console.log("Tabla creada");

  // Índices
  await client.query("CREATE INDEX IF NOT EXISTS idx_webrtc_events_session_id ON public.webrtc_events(session_id, created_at DESC)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_webrtc_events_claim_id ON public.webrtc_events(claim_id, created_at DESC)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_webrtc_events_event_type ON public.webrtc_events(event_type)");
  console.log("Índices creados");

  // RLS
  await client.query("ALTER TABLE public.webrtc_events ENABLE ROW LEVEL SECURITY");
  console.log("RLS habilitado");

  // Policies (DROP IF EXISTS primero, luego CREATE)
  await client.query(`DROP POLICY IF EXISTS "webrtc_events_read_authenticated" ON public.webrtc_events`);
  await client.query(`DROP POLICY IF EXISTS "webrtc_events_write_service_role" ON public.webrtc_events`);
  await client.query(`CREATE POLICY "webrtc_events_read_authenticated" ON public.webrtc_events FOR SELECT TO authenticated USING (true)`);
  await client.query(`CREATE POLICY "webrtc_events_write_service_role" ON public.webrtc_events FOR ALL TO service_role USING (true) WITH CHECK (true)`);
  console.log("Policies creadas");

  // Verificar
  const { rows } = await client.query("SELECT count(*) FROM public.webrtc_events");
  console.log("Verificación OK. Filas:", rows[0].count);

  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
