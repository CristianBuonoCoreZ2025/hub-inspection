// 1. Desactivar el profile corporativo de Gabriel Labra (mantener gmail).
// 2. Restaurar el email del Profile #2 de Camilo Chala a sognimc@gmail.com.
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
  // ── 1) Gabriel Labra: desactivar profile corporativo ──
  console.log(`\n=== 1) GABRIEL LABRA — Desactivar profile corporativo ===\n`);
  const GABRIEL_CORPORATIVO = "6e3d7a5e-d755-d7e8-fa29-f1c6770e019f"; // gabriel.labra@mclarens.cl
  const GABRIEL_GMAIL = "8c06be7d-fd9f-4542-9a32-035053abaf0e";       // glabra.mclarens@gmail.com

  // Verificar antes
  const { data: beforeCorp } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", GABRIEL_CORPORATIVO)
    .maybeSingle();
  const { data: beforeGmail } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", GABRIEL_GMAIL)
    .maybeSingle();
  console.log(`ANTES:`);
  console.log(`  Corporativo: ${beforeCorp?.email}  is_active=${beforeCorp?.is_active}`);
  console.log(`  Gmail:       ${beforeGmail?.email}  is_active=${beforeGmail?.is_active}`);

  // Desactivar corporativo
  const { error: e1 } = await supabase
    .from("profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", GABRIEL_CORPORATIVO);
  if (e1) {
    console.error(`ERROR al desactivar Gabriel corporativo: ${e1.message}`);
  } else {
    console.log(`\nProfile corporativo de Gabriel desactivado (is_active=false)`);
  }

  // Verificar después
  const { data: afterCorp } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", GABRIEL_CORPORATIVO)
    .maybeSingle();
  const { data: afterGmail } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", GABRIEL_GMAIL)
    .maybeSingle();
  console.log(`\nDESPUÉS:`);
  console.log(`  Corporativo: ${afterCorp?.email}  is_active=${afterCorp?.is_active}`);
  console.log(`  Gmail:       ${afterGmail?.email}  is_active=${afterGmail?.is_active}`);
  console.log(`\n>>> Gabriel debe loguearse con glabra.mclarens@gmail.com <<<`);

  // ── 2) Camilo Chala: restaurar email del Profile #2 ──
  console.log(`\n=== 2) CAMILO CHALA — Restaurar email Profile #2 ===\n`);
  const CAMILO_2 = "d564c965-3673-40fb-b05e-d45343ac48b9";

  // Verificar antes
  const { data: beforeCamilo } = await supabase
    .from("profiles")
    .select("id, full_name, email, updated_at")
    .eq("id", CAMILO_2)
    .maybeSingle();
  console.log(`ANTES:`);
  console.log(`  email: ${beforeCamilo?.email}`);
  console.log(`  updated_at: ${beforeCamilo?.updated_at}`);

  // Restaurar email
  const { error: e2 } = await supabase
    .from("profiles")
    .update({ email: "sognimc@gmail.com", updated_at: new Date().toISOString() })
    .eq("id", CAMILO_2);
  if (e2) {
    console.error(`ERROR al restaurar email de Camilo: ${e2.message}`);
  } else {
    console.log(`\nEmail restaurado a sognimc@gmail.com`);
  }

  // Verificar después
  const { data: afterCamilo } = await supabase
    .from("profiles")
    .select("id, full_name, email, updated_at")
    .eq("id", CAMILO_2)
    .maybeSingle();
  console.log(`\nDESPUÉS:`);
  console.log(`  email: ${afterCamilo?.email}`);
  console.log(`  updated_at: ${afterCamilo?.updated_at}`);

  // ── Resumen final ──
  console.log(`\n${"=".repeat(80)}`);
  console.log("RESUMEN FINAL");
  console.log(`${"=".repeat(80)}\n`);
  console.log("Camilo Chala:");
  console.log(`  Profile #1 (camilo.chala@mclarens.cl): INACTIVO, 0 claims`);
  console.log(`  Profile #2 (sognimc@gmail.com):        ACTIVO, 108 claims ← usar este`);
  console.log(`\nGabriel Labra:`);
  console.log(`  Profile #1 (gabriel.labra@mclarens.cl): INACTIVO, 0 claims`);
  console.log(`  Profile #2 (glabra.mclarens@gmail.com): ACTIVO, 0 claims ← usar este`);
}

main().catch((e) => { console.error(e); process.exit(1); });
