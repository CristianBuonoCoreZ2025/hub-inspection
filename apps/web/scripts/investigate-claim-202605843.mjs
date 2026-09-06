// Investiga por qué el inspector Camilo Chala no ve el caso 202605843.
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
  // 1) Buscar el claim con client_reference=202605843
  const { data: claims, error } = await supabase
    .from("claims")
    .select("id, client_reference, claim_number, disabled, disabled_reason, status_id, status:lookup_catalog!claims_status_id_fkey(code, name), inspector_id, inspector:profiles!claims_inspector_id_fkey(id, full_name, email), assigned_adjuster_id, assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(id, full_name), company_id, company:companies!claims_company_id_fkey(id, name), created_at, updated_at")
    .eq("client_reference", "202605843");

  if (error) { console.error("Error:", error.message); process.exit(1); }

  console.log(`\n=== CLAIMS con client_reference=202605843 ===\n`);
  if (!claims.length) {
    console.log("NO se encontró ningún claim con client_reference=202605843");
    // Buscar variantes
    const { data: variants } = await supabase
      .from("claims")
      .select("id, client_reference, claim_number, disabled, inspector_id, created_at")
      .ilike("client_reference", "%202605843%");
    console.log("\nVariantes (ilike %202605843%):");
    if (variants && variants.length) {
      for (const v of variants) console.log(`  ref="${v.client_reference}"  id=${v.id}  disabled=${v.disabled}  inspector_id=${v.inspector_id}`);
    } else {
      console.log("  Sin variantes");
    }
    return;
  }

  for (const c of claims) {
    console.log(`id: ${c.id}`);
    console.log(`client_reference: ${c.client_reference}`);
    console.log(`claim_number: ${c.claim_number}`);
    console.log(`disabled: ${c.disabled}  reason: ${c.disabled_reason || "-"}`);
    console.log(`status: ${c.status?.name || c.status?.code || "?"}`);
    console.log(`company: ${c.company?.name || "-"} (id=${c.company_id})`);
    console.log(`inspector_id: ${c.inspector_id || "(sin asignar)"}`);
    console.log(`inspector: ${c.inspector?.full_name || "-"} (email=${c.inspector?.email || "-"})`);
    console.log(`assigned_adjuster: ${c.assigned_adjuster?.full_name || "-"} (id=${c.assigned_adjuster_id})`);
    console.log(`created_at: ${c.created_at}`);
    console.log(`updated_at: ${c.updated_at}`);
  }

  // 2) Buscar al inspector "Camilo Chala" en profiles
  console.log(`\n=== BÚSQUEDA DE "Camilo Chala" EN PROFILES ===\n`);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role_id, role:roles(id, name)")
    .ilike("full_name", "%camilo%");

  if (profiles && profiles.length) {
    for (const p of profiles) {
      console.log(`id: ${p.id}`);
      console.log(`  full_name: ${p.full_name}`);
      console.log(`  email: ${p.email}`);
      console.log(`  user_id: ${p.user_id}`);
      console.log(`  company_id: ${p.company_id}`);
      console.log(`  role: ${p.role?.name || "?"} (id=${p.role_id})`);
      console.log("");
    }
  } else {
    console.log("No se encontró ningún profile con 'camilo' en full_name");
    // Buscar por "chala"
    const { data: byChala } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, company_id, role_id")
      .ilike("full_name", "%chala%");
    if (byChala && byChala.length) {
      console.log("Por 'chala':");
      for (const p of byChala) console.log(`  ${p.full_name}  id=${p.id}  email=${p.email}`);
    } else {
      console.log("Tampoco se encontró por 'chala'");
    }
  }

  // 3) Comparar inspector_id del claim con el ID de Camilo
  if (claims.length && profiles && profiles.length) {
    const claim = claims[0];
    console.log(`\n=== COMPARACIÓN ===\n`);
    console.log(`inspector_id del claim: ${claim.inspector_id}`);
    for (const p of profiles) {
      const match = claim.inspector_id === p.id;
      console.log(`  ¿${p.full_name} (id=${p.id})? → ${match ? "SÍ coincide" : "NO coincide"}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
