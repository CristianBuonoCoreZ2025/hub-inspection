// Unifica los dos profiles de Camilo Chala:
// 1. Reasigna 86 claims: inspector_id Profile #1 → Profile #2
// 2. Desactiva Profile #1 (is_active=false)
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
  console.log(`\n=== UNIFICACIÓN DE PROFILES DE CAMILO CHALA ===\n`);
  console.log(`Profile #1 (origen):  ${PROFILE_1} (camilo.chala@mclarens.cl)`);
  console.log(`Profile #2 (destino): ${PROFILE_2} (sognimc@gmail.com)\n`);

  // 1) Verificar conteo antes
  const { count: before } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("inspector_id", PROFILE_1);
  console.log(`Claims con inspector_id=Profile #1 ANTES: ${before}`);

  // 2) Actualizar los 86 claims
  console.log(`\nActualizando claims...`);
  const { data, error } = await supabase
    .from("claims")
    .update({ inspector_id: PROFILE_2, updated_at: new Date().toISOString() })
    .eq("inspector_id", PROFILE_1);

  if (error) {
    console.error(`ERROR al actualizar claims: ${error.message}`);
    process.exit(1);
  }

  // 3) Verificar conteo después
  const { count: after1 } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("inspector_id", PROFILE_1);
  const { count: after2 } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("inspector_id", PROFILE_2);
  console.log(`Claims con inspector_id=Profile #1 DESPUÉS: ${after1}`);
  console.log(`Claims con inspector_id=Profile #2 DESPUÉS: ${after2}`);

  if (after1 !== 0) {
    console.error(`\n⚠ ADVERTENCIA: aún quedan ${after1} claims con inspector_id=Profile #1`);
  }

  // 4) Desactivar Profile #1
  console.log(`\nDesactivando Profile #1...`);
  const { error: e2 } = await supabase
    .from("profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", PROFILE_1);
  if (e2) {
    console.error(`ERROR al desactivar Profile #1: ${e2.message}`);
  } else {
    console.log(`Profile #1 desactivado (is_active=false)`);
  }

  // 5) Verificación final
  console.log(`\n=== VERIFICACIÓN FINAL ===\n`);
  const { data: p1 } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", PROFILE_1)
    .maybeSingle();
  const { data: p2 } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", PROFILE_2)
    .maybeSingle();
  console.log(`Profile #1: ${p1 ? `${p1.full_name} (${p1.email}) is_active=${p1.is_active}` : "NO ENCONTRADO"}`);
  console.log(`Profile #2: ${p2 ? `${p2.full_name} (${p2.email}) is_active=${p2.is_active}` : "NO ENCONTRADO"}`);
  console.log(`\nClaims asignados a Profile #2: ${after2} (deben ser 108 = 86 + 22)`);
  console.log(`\n>>> Camilo debe loguearse con sognimc@gmail.com para ver todos sus casos. <<<`);
}

main().catch((e) => { console.error(e); process.exit(1); });
