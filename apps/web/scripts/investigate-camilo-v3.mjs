// Verifica el profile de Camilo y compara IDs.
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

const INSPECTOR_ID = "7b3678b8-9f21-b0d0-a3da-a2d95fdab563";

async function main() {
  // 1) Profile simple por ID (sin columnas que no existen)
  console.log(`\n=== PROFILE POR ID (simple) ===\n`);
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, company_id, active")
    .eq("id", INSPECTOR_ID)
    .maybeSingle();
  if (error) console.error("Error:", error.message);
  if (profile) {
    console.log(JSON.stringify(profile, null, 2));
  } else {
    console.log("No encontrado por ID");
  }

  // 2) ¿Es profiles una tabla o vista?
  console.log(`\n=== COLUMNAS DE profiles ===\n`);
  const { data: cols } = await supabase
    .rpc("to_jsonb", { x: 1 }); // dummy
  // Mejor: intentar select * limit 1
  const { data: sample, error: sErr } = await supabase
    .from("profiles")
    .select("*")
    .limit(1);
  if (sErr) console.error("Error sample:", sErr.message);
  if (sample && sample.length) {
    console.log("Columnas:", Object.keys(sample[0]).join(", "));
  }

  // 3) Buscar por full_name ilike camilo (sin email)
  console.log(`\n=== BÚSQUEDA POR NOMBRE ===\n`);
  const { data: byName } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, company_id, active")
    .ilike("full_name", "%camilo%")
    .limit(10);
  if (byName && byName.length) {
    for (const p of byName) console.log(JSON.stringify(p));
  } else {
    console.log("No encontrado por nombre 'camilo'");
    // Probar con "chala"
    const { data: byChala } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, company_id, active")
      .ilike("full_name", "%chala%")
      .limit(10);
    if (byChala && byChala.length) {
      for (const p of byChala) console.log(JSON.stringify(p));
    } else {
      console.log("Tampoco por 'chala'");
    }
  }

  // 4) ¿El inspector_id del claim es un user_id (auth.users) en vez de profile.id?
  // Buscar si hay un profile cuyo user_id = INSPECTOR_ID
  console.log(`\n=== BÚSQUEDA POR user_id = ${INSPECTOR_ID} ===\n`);
  const { data: byUserId } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, company_id, active")
    .eq("user_id", INSPECTOR_ID)
    .maybeSingle();
  if (byUserId) {
    console.log("ENCONTRADO por user_id:");
    console.log(JSON.stringify(byUserId, null, 2));
    console.log(`\n>>> El inspector_id del claim es el user_id, NO el profile.id <<<`);
    console.log(`>>> profile.id = ${byUserId.id}, user_id = ${byUserId.user_id} <<<`);
    console.log(`>>> La app filtra por profile.id, pero el claim tiene user_id <<<`);
  } else {
    console.log("No hay profile con user_id = inspector_id del claim");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
