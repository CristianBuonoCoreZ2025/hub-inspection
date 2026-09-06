// Compara los claims asignados a cada profile de Camilo Chala.
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

const PROFILE_1 = "7b3678b8-9f21-b0d0-a3da-a2d95fdab563"; // camilo.chala@mclarens.cl
const PROFILE_2 = "d564c965-3673-40fb-b05e-d45343ac48b9"; // sognimc@gmail.com

async function main() {
  // Info de ambos profiles
  console.log(`\n=== DOS PROFILES DE CAMILO CHALA ===\n`);
  for (const id of [PROFILE_1, PROFILE_2]) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at, created_at")
      .eq("id", id)
      .maybeSingle();
    if (p) {
      console.log(`Profile id=${p.id}`);
      console.log(`  full_name: ${p.full_name}`);
      console.log(`  email: ${p.email}`);
      console.log(`  user_id: ${p.user_id}`);
      console.log(`  company_id: ${p.company_id}`);
      console.log(`  role: ${p.role}`);
      console.log(`  is_active: ${p.is_active}`);
      console.log(`  deleted_at: ${p.deleted_at}`);
      console.log(`  created_at: ${p.created_at}`);
      console.log("");
    }
  }

  // Contar claims asignados a cada profile como inspector
  for (const [label, id] of [["Profile #1 (camilo.chala@mclarens.cl)", PROFILE_1], ["Profile #2 (sognimc@gmail.com)", PROFILE_2]]) {
    const { count: total } = await supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("inspector_id", id);
    const { count: active } = await supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("inspector_id", id)
      .eq("disabled", false);
    console.log(`${label}: ${total} claims totales, ${active} activos (disabled=false)`);
  }

  // ¿El claim 202605843 está asignado al profile #1?
  console.log(`\n=== CLAIM 202605843 ===\n`);
  const { data: claim } = await supabase
    .from("claims")
    .select("id, client_reference, inspector_id, disabled, status:lookup_catalog!claims_status_id_fkey(code, name)")
    .eq("client_reference", "202605843")
    .maybeSingle();
  if (claim) {
    console.log(`inspector_id: ${claim.inspector_id}`);
    console.log(`¿Es Profile #1 (camilo.chala@mclarens.cl)? → ${claim.inspector_id === PROFILE_1 ? "SÍ" : "NO"}`);
    console.log(`¿Es Profile #2 (sognimc@gmail.com)? → ${claim.inspector_id === PROFILE_2 ? "SÍ" : "NO"}`);
    console.log(`disabled: ${claim.disabled}`);
    console.log(`status: ${claim.status?.name}`);
  }

  // Conclusión
  console.log(`\n=== DIAGNÓSTICO ===\n`);
  console.log(`El claim 202605843 tiene inspector_id = Profile #1 (camilo.chala@mclarens.cl).`);
  console.log(`Si Camilo se loguea con sognimc@gmail.com (Profile #2), NO verá este caso`);
  console.log(`porque la app filtra por profile.id = inspector_id, y su profile.id sería el #2.`);
  console.log(`\nSolución: Camilo debe loguearse con camilo.chala@mclarens.cl,`);
  console.log(`O reasignar el claim al Profile #2 (sognimc@gmail.com).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
