import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const key = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function execSql(sql) {
  const { error } = await supabase.rpc("exec_sql", { sql_text: sql });
  if (error) console.log("  Error:", error.message);
  else console.log("  OK");
}

async function main() {
  console.log("Creando tabla webrtc_events...");
  await execSql(`CREATE TABLE IF NOT EXISTS public.webrtc_events (
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

  console.log("Creando índices...");
  await execSql("CREATE INDEX IF NOT EXISTS idx_webrtc_events_session_id ON public.webrtc_events(session_id, created_at DESC)");
  await execSql("CREATE INDEX IF NOT EXISTS idx_webrtc_events_claim_id ON public.webrtc_events(claim_id, created_at DESC)");
  await execSql("CREATE INDEX IF NOT EXISTS idx_webrtc_events_event_type ON public.webrtc_events(event_type)");

  console.log("Habilitando RLS...");
  await execSql("ALTER TABLE public.webrtc_events ENABLE ROW LEVEL SECURITY");

  console.log("Creando policies...");
  await execSql(`CREATE POLICY IF NOT EXISTS "webrtc_events_read_authenticated" ON public.webrtc_events FOR SELECT TO authenticated USING (true)`);
  await execSql(`CREATE POLICY IF NOT EXISTS "webrtc_events_write_service_role" ON public.webrtc_events FOR ALL TO service_role USING (true) WITH CHECK (true)`);

  console.log("Verificando...");
  const { data, error } = await supabase.from("webrtc_events").select("id").limit(1);
  if (error) console.log("Error:", error.message);
  else console.log("Tabla verificada. Registros:", data?.length || 0);
}

main().catch(console.error);
