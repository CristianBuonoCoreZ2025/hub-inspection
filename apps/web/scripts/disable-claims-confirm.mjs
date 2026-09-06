// Ejecuta la desactivación de los 57 claims según disable-plan.json.
// Marca disabled=true, disabled_reason, disabled_at. NO borra nada.
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

const REASON = "Carga errónea — desactivación solicitada por usuario";

async function main() {
  const planPath = resolve(__dirname, "disable-plan.json");
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const ids = plan.claims_to_disable.map((c) => c.id);

  console.log(`\n=== DESACTIVANDO ${ids.length} CLAIMS EN PRODUCCIÓN ===\n`);
  console.log(`Razón: ${REASON}\n`);

  let ok = 0;
  let fail = 0;
  const errors = [];

  for (const id of ids) {
    const { error } = await supabase
      .from("claims")
      .update({
        disabled: true,
        disabled_reason: REASON,
        disabled_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      fail++;
      errors.push({ id, message: error.message });
      console.log(`FAIL  ${id} → ${error.message}`);
    } else {
      ok++;
      console.log(`OK    ${id}`);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`Desactivados OK: ${ok}`);
  console.log(`Fallos: ${fail}`);
  if (errors.length) {
    console.log("\nErrores:");
    for (const e of errors) console.log(`  ${e.id}: ${e.message}`);
  }

  // Verificación: contar claims disabled con esa razón
  const { count } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", true)
    .eq("disabled_reason", REASON);
  console.log(`\nVerificación: ${count} claims con disabled=true y reason='${REASON}'`);
}

main().catch((e) => { console.error(e); process.exit(1); });
