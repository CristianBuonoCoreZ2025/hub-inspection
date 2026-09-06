// Detecta todos los inspectores con más de un profile (mismo full_name, distinto id).
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
  // Traer TODOS los profiles con role inspector (paginando)
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at, created_at")
      .eq("role", "inspector")
      .order("full_name", { ascending: true })
      .range(from, from + 199);
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 200) break;
    from += 200;
  }

  console.log(`\n=== INSPECTORES DUPLICADOS (mismo full_name, distinto profile) ===\n`);
  console.log(`Total profiles con role=inspector: ${all.length}\n`);

  // Agrupar por full_name (case-insensitive, trimmed)
  const byName = new Map();
  for (const p of all) {
    const key = (p.full_name || "").trim().toLowerCase();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
  }

  // Filtrar los que tienen más de 1 profile
  const dups = [];
  for (const [key, group] of byName.entries()) {
    if (group.length > 1) dups.push({ name: group[0].full_name, profiles: group });
  }

  console.log(`Inspectores con DUPLICADOS: ${dups.length}\n`);

  if (!dups.length) {
    console.log("No se encontraron inspectores duplicados.");
    return;
  }

  // Para cada duplicado, contar claims asignados a cada profile
  for (const d of dups) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`INSPECTOR: ${d.name} (${d.profiles.length} profiles)`);
    console.log(`${"=".repeat(80)}`);

    for (const p of d.profiles) {
      const { count: total } = await supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("inspector_id", p.id);
      const { count: active } = await supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("inspector_id", p.id)
        .eq("disabled", false);

      const status = !p.is_active ? "INACTIVO" : p.deleted_at ? "SOFT-DELETED" : "ACTIVO";
      console.log(`  [${status}] id=${p.id}`);
      console.log(`         email=${p.email}`);
      console.log(`         user_id=${p.user_id}`);
      console.log(`         company_id=${p.company_id}`);
      console.log(`         created_at=${p.created_at}`);
      console.log(`         claims: ${total} totales, ${active} activos`);
      console.log("");
    }
  }

  // Resumen compacto
  console.log(`\n${"=".repeat(80)}`);
  console.log("RESUMEN COMPACTO");
  console.log(`${"=".repeat(80)}\n`);
  console.log("Inspector              | Profiles | Detalle");
  console.log("-----------------------|----------|--------");
  for (const d of dups) {
    const detalle = d.profiles.map((p) => `${p.email} (${!p.is_active ? "inactivo" : "activo"})`).join(" + ");
    console.log(`${d.name.padEnd(22)} | ${String(d.profiles.length).padStart(8)} | ${detalle}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
