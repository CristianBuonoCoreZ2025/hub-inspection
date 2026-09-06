// Verifica si magic_link_connection_logs existe en producción.
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
  console.log(`\n=== VERIFICAR TABLA magic_link_connection_logs ===\n`);
  const { data, error } = await supabase
    .from("magic_link_connection_logs")
    .select("id, session_id, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.log(`Error: ${error.message}`);
    console.log("→ La tabla NO existe o no es accesible");
  } else if (data && data.length) {
    console.log(`Tabla existe. ${data.length} registros (mostrando últimos 10):`);
    for (const l of data) console.log(`  ${l.created_at}  session=${l.session_id}  role=${l.role}  status=${l.status}`);
  } else {
    console.log("Tabla existe pero está VACÍA (0 registros)");
  }

  // Contar total
  const { count } = await supabase
    .from("magic_link_connection_logs")
    .select("id", { count: "exact", head: true });
  console.log(`\nTotal registros: ${count || 0}`);

  // Buscar logs de la sesión L-000001708-HINS-001
  const { data: sessionLogs } = await supabase
    .from("magic_link_connection_logs")
    .select("*")
    .eq("session_id", "76bb90bf-9aac-45cc-b1e3-eb4f6d11a18e")
    .order("created_at", { ascending: true });
  console.log(`\nLogs de la sesión L-000001708-HINS-001: ${sessionLogs?.length || 0}`);
  if (sessionLogs && sessionLogs.length) {
    for (const l of sessionLogs) console.log(JSON.stringify(l, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
