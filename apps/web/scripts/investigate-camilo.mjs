// Investiga el profile de Camilo Chala por ID y cómo se filtran "sus casos".
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
const CLAIM_ID = "bf0e372b-df19-4b4b-8831-b91b86c70f5c";

async function main() {
  // 1) Buscar el profile por ID
  console.log(`\n=== PROFILE DE CAMILO CHALA (id=${INSPECTOR_ID}) ===\n`);
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role_id, role:roles(id, name), active, status")
    .eq("id", INSPECTOR_ID)
    .maybeSingle();

  if (pErr) console.error("Error:", pErr.message);
  if (!profile) {
    console.log("NO existe un profile con ese ID en la tabla profiles");
    // Buscar en auth.users
    console.log("\nBuscando en otras tablas...");
  } else {
    console.log(JSON.stringify(profile, null, 2));
  }

  // 2) Buscar por email
  console.log(`\n=== BÚSQUEDA POR EMAIL camilo.chala@mclarens.cl ===\n`);
  const { data: byEmail } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role_id, role:roles(id, name), active, status")
    .eq("email", "camilo.chala@mclarens.cl");
  if (byEmail && byEmail.length) {
    for (const p of byEmail) console.log(JSON.stringify(p, null, 2));
  } else {
    console.log("No se encontró por email exacto. Probando ilike...");
    const { data: byEmailLike } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, company_id, role_id, active, status")
      .ilike("email", "%camilo%");
    if (byEmailLike && byEmailLike.length) {
      for (const p of byEmailLike) console.log(JSON.stringify(p, null, 2));
    } else {
      console.log("Tampoco por ilike email");
    }
  }

  // 3) ¿Cuántos claims tiene asignados Camilo como inspector?
  console.log(`\n=== CLAIMS ASIGNADOS A CAMILO (inspector_id=${INSPECTOR_ID}) ===\n`);
  const { data: camiloClaims, error: cErr } = await supabase
    .from("claims")
    .select("id, client_reference, claim_number, disabled, status_id, status:lookup_catalog!claims_status_id_fkey(code, name), company_id, created_at")
    .eq("inspector_id", INSPECTOR_ID)
    .order("created_at", { ascending: false })
    .limit(20);
  if (cErr) console.error("Error:", cErr.message);
  if (camiloClaims) {
    console.log(`Total (hasta 20): ${camiloClaims.length}`);
    for (const c of camiloClaims) {
      const flag = c.disabled ? "[DISABLED]" : "[ACTIVE]  ";
      console.log(`${flag} ref=${c.client_reference}  claim=${c.claim_number}  status=${c.status?.name || "?"}  company=${c.company_id}  created=${c.created_at}`);
    }
  }

  // 4) Verificar el claim específico
  console.log(`\n=== VERIFICACIÓN DEL CLAIM ${CLAIM_ID} ===\n`);
  const { data: claim } = await supabase
    .from("claims")
    .select("id, client_reference, claim_number, disabled, disabled_reason, status_id, status:lookup_catalog!claims_status_id_fkey(code, name), inspector_id, company_id, created_at, updated_at")
    .eq("id", CLAIM_ID)
    .maybeSingle();
  if (claim) {
    console.log(JSON.stringify(claim, null, 2));
  } else {
    console.log("No se pudo obtener el claim");
  }

  // 5) ¿El claim tiene gestiones? ¿Quién las creó?
  console.log(`\n=== GESTIONES DEL CLAIM ${CLAIM_ID} ===\n`);
  const { data: actions } = await supabase
    .from("claim_actions")
    .select("id, claim_id, action_template_id, is_active, created_on, created_by, assigned_to, action_status:lookup_catalog!claim_actions_action_status_id_fkey(code, name)")
    .eq("claim_id", CLAIM_ID)
    .order("created_on", { ascending: false });
  if (actions && actions.length) {
    for (const a of actions) {
      console.log(`id=${a.id}  is_active=${a.is_active}  status=${a.action_status?.name || "?"}  assigned_to=${a.assigned_to || "-"}  created_by=${a.created_by || "-"}  created_on=${a.created_on}`);
    }
  } else {
    console.log("Sin gestiones");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
