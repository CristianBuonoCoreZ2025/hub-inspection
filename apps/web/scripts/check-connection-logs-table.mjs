// Verifica si la tabla de connection_logs existe y tiene datos.
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
  // 1) ¿Existe la tabla inspection_connection_logs?
  console.log(`\n=== TABLA inspection_connection_logs ===\n`);
  const { data: logs, error: err1 } = await supabase
    .from("inspection_connection_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
  if (err1) {
    console.log(`Error: ${err1.message}`);
    console.log("→ La tabla NO existe o no es accesible");
  } else if (logs && logs.length) {
    console.log(`Tabla existe. ${logs.length} registros (mostrando últimos 5):`);
    console.log(`Columnas: ${Object.keys(logs[0]).join(", ")}`);
    for (const l of logs) console.log(JSON.stringify(l));
  } else {
    console.log("Tabla existe pero está VACÍA (0 registros)");
  }

  // 2) Contar total
  const { count } = await supabase
    .from("inspection_connection_logs")
    .select("id", { count: "exact", head: true });
  console.log(`\nTotal registros: ${count || 0}`);

  // 3) Buscar logs de la sesión específica
  const { data: sessionLogs } = await supabase
    .from("inspection_connection_logs")
    .select("*")
    .eq("session_id", "76bb90bf-9aac-45cc-b1e3-eb4f6d11a18e")
    .order("created_at", { ascending: true });
  console.log(`\nLogs de la sesión L-000001708-HINS-001: ${sessionLogs?.length || 0}`);
  if (sessionLogs && sessionLogs.length) {
    for (const l of sessionLogs) console.log(JSON.stringify(l, null, 2));
  }

  // 4) ¿Hay logs de OTRAS sesiones? (para ver si el sistema funciona en general)
  const { data: otherLogs } = await supabase
    .from("inspection_connection_logs")
    .select("id, session_id, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (otherLogs && otherLogs.length) {
    console.log(`\nÚltimos logs de otras sesiones:`);
    for (const l of otherLogs) console.log(`  ${l.created_at}  session=${l.session_id}  role=${l.role}  status=${l.status}`);
  }

  // 5) Probar conectividad con freeturn.net
  console.log(`\n=== TEST DE CONECTIVIDAD freeturn.net ===\n`);
  try {
    const res = await fetch("https://freeturn.net/", { method: "HEAD", signal: AbortSignal.timeout(10000) });
    console.log(`freeturn.net HTTP status: ${res.status}`);
    console.log(`freeturn.net responde: SÍ`);
  } catch (e) {
    console.log(`freeturn.net NO responde: ${e.message}`);
  }

  // 6) Probar stun de Google
  console.log(`\n=== TEST STUN de Google ===\n`);
  try {
    const res = await fetch("https://stun.l.google.com:19302", { method: "HEAD", signal: AbortSignal.timeout(10000) });
    console.log(`stun.l.google.com HTTP status: ${res.status}`);
  } catch (e) {
    console.log(`stun.l.google.com (esperado, STUN no es HTTP): ${e.message}`);
    console.log("(Esto es normal — STU no responde a HTTP)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
