// Lista todos los claims asignados a Camilo Chala (Profile #2) con
// liquidation_number, estado (texto) y fecha de creación.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
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

const PROFILE_2 = "d564c965-3673-40fb-b05e-d45343ac48b9"; // sognimc@gmail.com

async function main() {
  // Traer TODOS los claims (paginando porque PostgREST limita a 200)
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("claims")
      .select("id, client_reference, claim_number, liquidation_number, disabled, status:lookup_catalog!claims_status_id_fkey(code, name), created_at")
      .eq("inspector_id", PROFILE_2)
      .order("created_at", { ascending: true })
      .range(from, from + 199);
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 200) break;
    from += 200;
  }

  console.log(`\n=== CASOS DE CAMILO CHALA (sognimc@gmail.com) ===\n`);
  console.log(`Total: ${all.length} claims\n`);
  console.log(`${"#".padEnd(3)} | ${"liquidation".padEnd(14)} | ${"estado".padEnd(13)} | ${"disabled".padEnd(8)} | ${"fecha_creacion".padEnd(23)} | ${"ref".padEnd(15)} | claim_number`);

  let i = 1;
  for (const c of all) {
    const estado = c.status?.name || c.status?.code || "?";
    const liq = c.liquidation_number || "-";
    const dis = c.disabled ? "SÍ" : "no";
    const created = c.created_at;
    const ref = c.client_reference || "-";
    const num = c.claim_number || "-";
    console.log(`${String(i).padStart(3)} | ${liq.padEnd(14)} | ${estado.padEnd(13)} | ${dis.padEnd(8)} | ${created.padEnd(23)} | ${ref.padEnd(15)} | ${num}`);
    i++;
  }

  // Resumen
  const active = all.filter((c) => !c.disabled).length;
  const disabled = all.filter((c) => c.disabled).length;
  console.log(`\nActivos: ${active}, Desactivados: ${disabled}`);

  // Guardar CSV
  const csvPath = resolve(__dirname, "camilo-claims.csv");
  const header = "numero,client_reference,claim_number,liquidation_number,estado,disabled,fecha_creacion";
  const lines = all.map((c, idx) =>
    `${idx + 1},${c.client_reference || ""},${c.claim_number || ""},${c.liquidation_number || ""},${(c.status?.name || c.status?.code || "").replace(/,/g, ";")},${c.disabled ? "SI" : "no"},${c.created_at}`
  );
  writeFileSync(csvPath, [header, ...lines].join("\n"), "utf8");
  console.log(`\nCSV guardado en: ${csvPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
