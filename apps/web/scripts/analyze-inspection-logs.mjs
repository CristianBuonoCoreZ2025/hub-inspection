// Revisa logs de conexión y eventos de inspección de la sesión.
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
  // 1) Buscar tabla de logs de conexión
  console.log(`\n=== LOGS DE CONEXIÓN ===\n`);
  for (const table of ["inspection_connection_logs", "connection_logs", "inspection_logs"]) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("session_id", SESSION_ID)
      .order("created_at", { ascending: true })
      .limit(50);
    if (!error && data) {
      console.log(`Tabla ${table}: ${data.length} registros`);
      if (data.length) {
        console.log(`Columnas: ${Object.keys(data[0]).join(", ")}\n`);
        for (const r of data) {
          console.log(JSON.stringify(r));
        }
      }
    }
  }

  // 2) Buscar eventos de inspección
  console.log(`\n=== EVENTOS DE INSPECCIÓN ===\n`);
  for (const table of ["inspection_events", "inspection_audit_logs"]) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("session_id", SESSION_ID)
      .order("created_at", { ascending: true })
      .limit(50);
    if (!error && data) {
      console.log(`Tabla ${table}: ${data.length} registros`);
      if (data.length) {
        console.log(`Columnas: ${Object.keys(data[0]).join(", ")}\n`);
        for (const r of data) {
          console.log(JSON.stringify(r));
        }
      }
    }
  }

  // 3) Buscar el claim_action asociado
  console.log(`\n=== CLAIM_ACTION ASOCIADO ===\n`);
  const { data: action } = await supabase
    .from("claim_actions")
    .select("*")
    .eq("id", "e0d2ace8-1ae0-46f7-b0ed-895716b6e1c8")
    .maybeSingle();
  if (action) {
    console.log(JSON.stringify(action, null, 2));
  }

  // 4) Verificar el inspector Victor Carrasco
  console.log(`\n=== INSPECTOR VICTOR CARRASCO ===\n`);
  const { data: inspector } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at, created_at")
    .eq("id", "f8f674c1-8ca3-437c-a684-9653b8809614")
    .maybeSingle();
  if (inspector) {
    console.log(JSON.stringify(inspector, null, 2));
  }

  // 5) ¿Quién es 56cee56e-967f-4f10-a98d-08e79c6a8bec? (lock_overridden_by)
  console.log(`\n=== QUIÉN HIZO LOCK OVERRIDE (56cee56e-...) ===\n`);
  const { data: overrider } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, role, is_active")
    .eq("id", "56cee56e-967f-4f10-a98d-08e79c6a8bec")
    .maybeSingle();
  if (overrider) {
    console.log(JSON.stringify(overrider, null, 2));
  } else {
    console.log("No encontrado en profiles");
  }

  // 6) URL del magic link
  console.log(`\n=== MAGIC LINK ===\n`);
  console.log(`token: 69536d50b130461f99741bcf76d61080`);
  console.log(`expires_at: 2026-08-25T23:04:17.155+00:00`);
  console.log(`URL: https://claims.fdpchile.com/inspection/69536d50b130461f99741bcf76d61080`);
  console.log(`magic_link_extended: false`);

  // 7) Verificar si el asegurado tiene el email correcto
  console.log(`\n=== DATOS DEL ASEGURADO ===\n`);
  console.log(`Participante insured: ALVARO ROJAS GARAY, email=NEIVI.MOLINA1@GMAIL.COM, phone=993596739`);
  console.log(`Entrevistado: Neivi Molina, email=NEIVI.MOLINA1@GMAIL.COM, relación=Familiar`);
  console.log(`\nNOTA: El email del asegurado (ALVARO ROJAS GARAY) es NEIVI.MOLINA1@GMAIL.COM`);
  console.log(`      que parece ser el email de un familiar (Neivi Molina), no del asegurado mismo.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
