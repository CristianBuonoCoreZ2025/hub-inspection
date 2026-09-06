// Confirma el profile de Camilo y revisa cómo se listan "mis casos" del inspector.
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
  // 1) Profile SIN join con roles (que dio error de schema cache)
  console.log(`\n=== PROFILE DE CAMILO (sin JOIN con roles) ===\n`);
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role_id, active, status")
    .eq("id", INSPECTOR_ID)
    .maybeSingle();
  if (error) console.error("Error:", error.message);
  if (profile) {
    console.log(JSON.stringify(profile, null, 2));
  } else {
    console.log("No encontrado por ID. Buscando por email ilike...");
    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, company_id, role_id, active, status")
      .ilike("email", "%camilo%chala%");
    if (byEmail && byEmail.length) {
      for (const p of byEmail) console.log(JSON.stringify(p, null, 2));
    } else {
      // Buscar todos los que tengan mclarens en email
      const { data: mcl } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, company_id, role_id, active")
        .ilike("email", "%mclarens%")
        .limit(30);
      console.log(`\nProfiles con email @mclarens: ${mcl?.length || 0}`);
      if (mcl) for (const p of mcl) console.log(`  ${p.full_name}  email=${p.email}  id=${p.id}  role_id=${p.role_id}  active=${p.active}`);
    }
  }

  // 2) ¿El claim 202605843 tiene gestiones asignadas a Camilo?
  console.log(`\n=== GESTIONES ASIGNADAS A CAMILO (assigned_to=${INSPECTOR_ID}) ===\n`);
  const { count: actionsCount } = await supabase
    .from("claim_actions")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", INSPECTOR_ID);
  console.log(`Total gestiones asignadas a Camilo: ${actionsCount || 0}`);

  // 3) ¿Cuántos claims distintos tiene Camilo con gestiones asignadas?
  const { data: camiloActions } = await supabase
    .from("claim_actions")
    .select("claim_id, is_active, assigned_to")
    .eq("assigned_to", INSPECTOR_ID)
    .eq("is_active", true);
  const claimIds = new Set((camiloActions || []).map((a) => a.claim_id));
  console.log(`Claims distintos con gestión asignada a Camilo (is_active=true): ${claimIds.size}`);

  // 4) ¿El claim 202605843 está entre esos?
  const CLAIM_ID = "bf0e372b-df19-4b4b-8831-b91b86c70f5c";
  console.log(`\n¿El claim 202605843 (${CLAIM_ID}) tiene gestión asignada a Camilo? → ${claimIds.has(CLAIM_ID) ? "SÍ" : "NO"}`);

  // 5) ¿El inspector_id del claim coincide con el user_id o el id del profile?
  console.log(`\n=== NOTA ===`);
  console.log(`inspector_id del claim = ${INSPECTOR_ID}`);
  console.log(`En el primer script, el JOIN inspector:profiles!claims_inspector_id_fkey trajo:`);
  console.log(`  full_name="Camilo Chala"  email="camilo.chala@mclarens.cl"`);
  console.log(`Esto significa que SÍ existe un profile con id=${INSPECTOR_ID}.`);
  console.log(`El error anterior fue por el JOIN con 'roles', no porque el profile no exista.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
