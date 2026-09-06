// Búsqueda exhaustiva del profile de Camilo Chala.
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
  // 1) Buscar por ID con columnas correctas
  console.log(`\n=== 1) PROFILE POR ID ===\n`);
  const { data: p1, error: e1 } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at")
    .eq("id", INSPECTOR_ID)
    .maybeSingle();
  if (e1) console.error("Error:", e1.message);
  console.log("Resultado:", p1 ? JSON.stringify(p1, null, 2) : "NO ENCONTRADO");

  // 2) Buscar por email exacto
  console.log(`\n=== 2) POR EMAIL EXACTO ===\n`);
  const { data: p2, error: e2 } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at")
    .eq("email", "camilo.chala@mclarens.cl")
    .maybeSingle();
  if (e2) console.error("Error:", e2.message);
  console.log("Resultado:", p2 ? JSON.stringify(p2, null, 2) : "NO ENCONTRADO");

  // 3) Buscar por email ilike (por si hay mayúsculas)
  console.log(`\n=== 3) POR EMAIL ILIKE %camilo% ===\n`);
  const { data: p3 } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at")
    .ilike("email", "%camilo%")
    .limit(10);
  console.log("Resultado:", p3 && p3.length ? JSON.stringify(p3, null, 2) : "VACÍO");

  // 4) Buscar TODOS los profiles con deleted_at NOT NULL (soft-deleted)
  console.log(`\n=== 4) PROFILES SOFT-DELETED (deleted_at NOT NULL) ===\n`);
  const { data: p4 } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, deleted_at")
    .not("deleted_at", "is", null)
    .limit(20);
  if (p4 && p4.length) {
    for (const p of p4) {
      const isCamilo = p.id === INSPECTOR_ID || (p.email || "").toLowerCase().includes("camilo");
      const tag = isCamilo ? " ← CANDIDATO" : "";
      console.log(`  id=${p.id}  email=${p.email}  name=${p.full_name}  deleted=${p.deleted_at}${tag}`);
    }
  } else {
    console.log("No hay profiles soft-deleted");
  }

  // 5) ¿El inspector_id del claim existe en auth.users?
  // No podemos consultar auth.users directamente via PostgREST, pero podemos
  // buscar si hay algún profile cuyo user_id o id coincida
  console.log(`\n=== 5) ¿HAY ALGÚN PROFILE CON ID O USER_ID PARECIDO? ===\n`);
  // Buscar los primeros 3 caracteres del ID para ver si hay coincidencias parciales
  // PostgREST no soporta ilike en UUIDs, así que listamos todos y filtramos en JS
  const { data: all } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email")
    .limit(1000);
  if (all) {
    const target = INSPECTOR_ID.toLowerCase();
    const matches = all.filter((p) =>
      p.id.toLowerCase() === target ||
      (p.user_id || "").toLowerCase() === target ||
      (p.email || "").toLowerCase().includes("camilo") ||
      (p.full_name || "").toLowerCase().includes("camilo") ||
      (p.full_name || "").toLowerCase().includes("chala")
    );
    if (matches.length) {
      console.log("Coincidencias encontradas:");
      for (const m of matches) console.log(`  id=${m.id}  user_id=${m.user_id}  name=${m.full_name}  email=${m.email}`);
    } else {
      console.log(`No hay coincidencias en ${all.length} profiles. El inspector_id del claim NO existe en profiles.`);
      console.log(`\n>>> CONCLUSIÓN: El profile de Camilo Chala fue ELIMINADO de la tabla profiles. <<<`);
      console.log(`>>> El claim mantiene inspector_id=${INSPECTOR_ID} que apunta a un profile inexistente. <<<`);
      console.log(`>>> Por eso Camilo no ve el caso: al loguearse, su profile.id es distinto o no existe. <<<`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
