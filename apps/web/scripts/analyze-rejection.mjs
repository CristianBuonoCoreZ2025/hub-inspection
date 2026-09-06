// Verifica el estado actual de la sesión y si hay múltiples clientes conectados.
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

async function main() {
  // 1) Estado de la sesión L-000001708-HINS-001
  console.log(`\n=== ESTADO DE LA SESIÓN L-000001708-HINS-001 ===\n`);
  const { data: sess } = await supabase
    .from("inspection_sessions")
    .select("id, status, inspection_number, started_at, ended_at, magic_link_token, magic_link_expires_at, inspector_id, active_tab, acta_step, updated_at")
    .eq("inspection_number", "L-000001708-HINS-001")
    .maybeSingle();
  if (sess) {
    console.log(`status: ${sess.status}`);
    console.log(`started_at: ${sess.started_at}`);
    console.log(`ended_at: ${sess.ended_at}`);
    console.log(`magic_link_expires_at: ${sess.magic_link_expires_at}`);
    console.log(`active_tab: ${sess.active_tab}`);
    console.log(`acta_step: ${sess.acta_step}`);
    console.log(`updated_at: ${sess.updated_at}`);
  }

  // 2) Logs de conexión recientes de esta sesión
  console.log(`\n=== LOGS DE CONEXIÓN RECIENTES ===\n`);
  const { data: logs } = await supabase
    .from("magic_link_connection_logs")
    .select("*")
    .eq("session_id", "76bb90bf-9aac-45cc-b1e3-eb4f6d11a18e")
    .order("created_at", { ascending: false })
    .limit(15);
  if (logs && logs.length) {
    console.log(`Últimos ${logs.length} logs:`);
    for (const l of logs) {
      console.log(`\n  [${l.created_at}] role=${l.role}  status=${l.status}  camera=${l.camera_permission}  mic=${l.microphone_permission}`);
      console.log(`    IP=${l.ip_address}  device=${l.device_type}  browser=${l.browser} ${l.browser_version}  OS=${l.os} ${l.os_version}`);
      console.log(`    disconnect_reason=${l.disconnect_reason || "—"}  failure_reason=${l.failure_reason || "—"}`);
      console.log(`    connected_at=${l.connected_at}  disconnected_at=${l.disconnected_at || "—"}`);
    }
  } else {
    console.log("Sin logs recientes.");
  }

  // 3) ¿Hay OTRAS sesiones activas para el mismo claim?
  console.log(`\n=== OTRAS SESIONES DEL MISMO CLAIM ===\n`);
  const { data: otherSessions } = await supabase
    .from("inspection_sessions")
    .select("id, inspection_number, status, started_at, ended_at, inspection_type")
    .eq("claim_id", "72748339-c8e1-40e8-8f6f-c5e3ce1f4fe6")
    .order("created_at", { ascending: false });
  if (otherSessions && otherSessions.length) {
    for (const s of otherSessions) {
      console.log(`  ${s.inspection_number}  status=${s.status}  type=${s.inspection_type}  started=${s.started_at}  ended=${s.ended_at || "—"}`);
    }
  }

  // 4) Mensajes de chat recientes
  console.log(`\n=== MENSAJES DE CHAT RECIENTES ===\n`);
  const { data: msgs } = await supabase
    .from("inspection_chat_messages")
    .select("id, sender_role, sender_name, content, created_at")
    .eq("session_id", "76bb90bf-9aac-45cc-b1e3-eb4f6d11a18e")
    .order("created_at", { ascending: false })
    .limit(10);
  if (msgs && msgs.length) {
    for (const m of msgs) {
      console.log(`  [${m.created_at}] ${m.sender_role || "inspector"} (${m.sender_name}): ${m.content}`);
    }
  }

  // 5) ¿Hay sesiones activas de OTROS claims con el mismo inspector?
  console.log(`\n=== OTRAS SESIONES ACTIVAS DEL INSPECTOR VICTOR ===\n`);
  const { data: inspectorSessions } = await supabase
    .from("inspection_sessions")
    .select("id, inspection_number, status, started_at, ended_at, inspection_type, claim_id")
    .eq("inspector_id", "f8f674c1-8ca3-437c-a684-9653b8809614")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(10);
  if (inspectorSessions && inspectorSessions.length) {
    console.log(`Sesiones activas del inspector: ${inspectorSessions.length}`);
    for (const s of inspectorSessions) {
      console.log(`  ${s.inspection_number}  status=${s.status}  started=${s.started_at}  ended=${s.ended_at || "—"}`);
    }
  } else {
    console.log("El inspector no tiene otras sesiones activas.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
