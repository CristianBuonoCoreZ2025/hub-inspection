// Limpia las conexiones activas de la sesión L-000001708-HINS-001.
// Marca todos los logs con disconnected_at=null como disconnected.
// NO toca la sesión ni los claims — solo limpia logs de conexión.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..", "..");

const envFile = readFileSync(resolve(root, ".env.production"), "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SESSION_ID = "76bb90bf-9aac-45cc-b1e3-eb4f6d11a18e";

async function main() {
  // 1) Ver logs activos antes de limpiar
  console.log(`\n=== LOGS ACTIVOS (disconnected_at = null) ANTES DE LIMPIAR ===\n`);
  const { data: active } = await supabase
    .from("magic_link_connection_logs")
    .select("id, role, status, ip_address, connected_at, disconnected_at")
    .eq("session_id", SESSION_ID)
    .is("disconnected_at", null)
    .order("created_at", { ascending: true });
  if (active && active.length) {
    for (const l of active) {
      console.log(`  id=${l.id}  role=${l.role}  status=${l.status}  IP=${l.ip_address}  connected=${l.connected_at}`);
    }
    console.log(`\nTotal: ${active.length} logs activos`);
  } else {
    console.log("No hay logs activos.");
  }

  // 2) Marcar todos como disconnected
  if (active && active.length) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("magic_link_connection_logs")
      .update({ disconnected_at: now, disconnect_reason: "cleanup_manual" })
      .eq("session_id", SESSION_ID)
      .is("disconnected_at", null);
    if (error) {
      console.error(`Error al limpiar: ${error.message}`);
      return;
    }
    console.log(`\n✓ ${active.length} logs marcados como disconnected (reason=cleanup_manual)`);
  }

  // 3) Verificar después
  console.log(`\n=== VERIFICACIÓN DESPUÉS DE LIMPIAR ===\n`);
  const { data: remaining } = await supabase
    .from("magic_link_connection_logs")
    .select("id, role, status, disconnected_at")
    .eq("session_id", SESSION_ID)
    .is("disconnected_at", null);
  console.log(`Logs aún activos: ${remaining?.length || 0}`);

  // 4) Estado de la sesión (no se toca)
  const { data: sess } = await supabase
    .from("inspection_sessions")
    .select("id, status, inspection_number, started_at, ended_at, magic_link_expires_at")
    .eq("id", SESSION_ID)
    .maybeSingle();
  if (sess) {
    console.log(`\nSesión (NO modificada):`);
    console.log(`  status: ${sess.status}`);
    console.log(`  started_at: ${sess.started_at}`);
    console.log(`  ended_at: ${sess.ended_at}`);
    console.log(`  magic_link_expires_at: ${sess.magic_link_expires_at}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
