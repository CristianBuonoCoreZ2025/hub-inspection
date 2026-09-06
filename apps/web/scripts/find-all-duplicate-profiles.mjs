// Verifica duplicados por email (no solo por nombre) y revisa el email raro de Camilo.
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
  // 1) Revisar el profile de Camilo #2 — el email cambió a "6461 0140"
  console.log(`\n=== PROFILE #2 DE CAMILO (¿email cambió?) ===\n`);
  const { data: camilo2 } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at, created_at, updated_at")
    .eq("id", "d564c965-3673-40fb-b05e-d45343ac48b9")
    .maybeSingle();
  if (camilo2) {
    console.log(JSON.stringify(camilo2, null, 2));
  }

  // 2) Buscar TODOS los profiles (no solo inspectores) duplicados por nombre
  console.log(`\n=== TODOS LOS PROFILES DUPLICADOS POR NOMBRE (cualquier rol) ===\n`);
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, company_id, role, is_active, deleted_at, created_at")
      .order("full_name", { ascending: true })
      .range(from, from + 199);
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 200) break;
    from += 200;
  }

  console.log(`Total profiles: ${all.length}`);

  // Agrupar por nombre
  const byName = new Map();
  for (const p of all) {
    const key = (p.full_name || "").trim().toLowerCase();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
  }

  const dups = [];
  for (const [key, group] of byName.entries()) {
    if (group.length > 1) dups.push({ name: group[0].full_name, profiles: group });
  }

  console.log(`Profiles duplicados por nombre: ${dups.length}\n`);
  console.log("Nombre                          | Rol        | Cantidad | Emails");
  console.log("--------------------------------|------------|----------|-------");
  for (const d of dups) {
    const roles = [...new Set(d.profiles.map((p) => p.role))].join("/");
    const emails = d.profiles.map((p) => `${p.email}${!p.is_active ? " (inactivo)" : ""}`).join(" + ");
    console.log(`${d.name.padEnd(31)} | ${roles.padEnd(10)} | ${String(d.profiles.length).padStart(8)} | ${emails}`);
  }

  // 3) Duplicados por email (mismo email, distinto id)
  console.log(`\n=== DUPLICADOS POR EMAIL ===\n`);
  const byEmail = new Map();
  for (const p of all) {
    const key = (p.email || "").trim().toLowerCase();
    if (!key) continue;
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(p);
  }
  const emailDups = [];
  for (const [key, group] of byEmail.entries()) {
    if (group.length > 1) emailDups.push({ email: group[0].email, profiles: group });
  }
  console.log(`Duplicados por email: ${emailDups.length}`);
  for (const d of emailDups) {
    console.log(`\n  Email: ${d.email}`);
    for (const p of d.profiles) {
      console.log(`    id=${p.id}  name=${p.full_name}  role=${p.role}  is_active=${p.is_active}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
