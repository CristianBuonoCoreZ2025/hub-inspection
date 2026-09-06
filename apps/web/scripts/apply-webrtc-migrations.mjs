// Aplicar migraciones WebRTC a producción via PostgreSQL directo
import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration1 = `
CREATE TABLE IF NOT EXISTS public.turn_cache (
  id text PRIMARY KEY DEFAULT 'singleton',
  ice_servers jsonb NOT NULL,
  expires_at bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.turn_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turn_cache FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'turn_cache' AND policyname = 'turn_cache_service_role_only'
  ) THEN
    CREATE POLICY "turn_cache_service_role_only" ON public.turn_cache
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
`.trim();

const migration2 = `
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

CREATE INDEX IF NOT EXISTS idx_webrtc_stats_session_id ON public.webrtc_stats (session_id, created_at DESC);

ALTER TABLE public.webrtc_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_stats FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'webrtc_stats' AND policyname = 'webrtc_stats_read'
  ) THEN
    CREATE POLICY "webrtc_stats_read" ON public.webrtc_stats
      FOR SELECT
      USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'webrtc_stats' AND policyname = 'webrtc_stats_write'
  ) THEN
    CREATE POLICY "webrtc_stats_write" ON public.webrtc_stats
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
`.trim();

async function main() {
  console.log("Conectando a:", connectionString.split("@")[1]?.split("/")[0]);

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("\n=== Migración 1: turn_cache ===");
  try {
    await client.query(migration1);
    console.log("OK — tabla turn_cache creada");
  } catch (err) {
    console.error("Error:", err.message);
  }

  console.log("\n=== Migración 2: webrtc_stats ===");
  try {
    await client.query(migration2);
    console.log("OK — tabla webrtc_stats creada");
  } catch (err) {
    console.error("Error:", err.message);
  }

  // Verificar
  console.log("\n=== Verificación ===");
  const r1 = await client.query("SELECT count(*) FROM public.turn_cache");
  console.log("turn_cache filas:", r1.rows[0].count);

  const r2 = await client.query("SELECT count(*) FROM public.webrtc_stats");
  console.log("webrtc_stats filas:", r2.rows[0].count);

  const r3 = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('turn_cache','webrtc_stats')");
  console.log("Tablas creadas:", r3.rows.map((r) => r.tablename).join(", "));

  await client.end();
  console.log("\nListo.");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
