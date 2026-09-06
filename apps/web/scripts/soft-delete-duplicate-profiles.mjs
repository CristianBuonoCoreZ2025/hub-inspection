// Soft-delete de los profiles inactivos duplicados:
// - Camilo Chala #1 (camilo.chala@mclarens.cl)
// - Gabriel Labra #1 (gabriel.labra@mclarens.cl)
// Marca deleted_at = now() para que desaparezcan de las listas normales
// y libere el email para validaciones de unicidad.
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

const PROFILES_TO_DELETE = [
  {
    id: "7b3678b8-9f21-b0d0-a3da-a2d95fdab563",
    name: "Camilo Chala",
    email: "camilo.chala@mclarens.cl",
  },
  {
    id: "6e3d7a5e-d755-d7e8-fa29-f1c6770e019f",
    name: "Gabriel Labra",
    email: "gabriel.labra@mclarens.cl",
  },
];

async function main() {
  console.log(`\n=== SOFT-DELETE DE PROFILES DUPLICADOS INACTIVOS ===\n`);

  for (const p of PROFILES_TO_DELETE) {
    console.log(`\n--- ${p.name} (${p.email}) ---`);
    console.log(`  id: ${p.id}`);

    // Verificar antes
    const { data: before } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_active, deleted_at")
      .eq("id", p.id)
      .maybeSingle();
    console.log(`  ANTES: is_active=${before?.is_active}, deleted_at=${before?.deleted_at || "(null)"}`);

    // Aplicar soft-delete: deleted_at = now() + is_active = false
    const { error } = await supabase
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);

    if (error) {
      console.error(`  ERROR: ${error.message}`);
      continue;
    }

    // Verificar después
    const { data: after } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_active, deleted_at")
      .eq("id", p.id)
      .maybeSingle();
    console.log(`  DESPUÉS: is_active=${after?.is_active}, deleted_at=${after?.deleted_at}`);
    console.log(`  ✓ Profile movido a "Eliminados" — ya no aparece en listas normales`);
  }

  // Resumen final
  console.log(`\n${"=".repeat(80)}`);
  console.log("ESTADO FINAL DE LOS 4 PROFILES");
  console.log(`${"=".repeat(80)}\n`);

  const allIds = [
    { id: "7b3678b8-9f21-b0d0-a3da-a2d95fdab563", label: "Camilo #1 (corporativo)" },
    { id: "d564c965-3673-40fb-b05e-d45343ac48b9", label: "Camilo #2 (sognimc@gmail.com)" },
    { id: "6e3d7a5e-d755-d7e8-fa29-f1c6770e019f", label: "Gabriel #1 (corporativo)" },
    { id: "8c06be7d-fd9f-4542-9a32-035053abaf0e", label: "Gabriel #2 (glabra.mclarens@gmail.com)" },
  ];

  for (const p of allIds) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_active, deleted_at")
      .eq("id", p.id)
      .maybeSingle();
    if (data) {
      const estado = data.deleted_at ? "ELIMINADO" : data.is_active ? "ACTIVO" : "INACTIVO";
      console.log(`  ${p.label.padEnd(35)} → ${estado.padEnd(10)}  email=${data.email}`);
    }
  }

  console.log(`\n>>> Los profiles eliminados ya no aparecen en las listas de usuarios. <<<`);
  console.log(`>>> Para revertir: actualizar deleted_at = null, is_active = true. <<<`);
  console.log(`\nNOTA: Falta banear a estos usuarios en auth.users para que no puedan`);
  console.log(`loguearse. Eso se hace desde la UI de la app (botón Eliminar) o vía`);
  console.log(`Supabase Dashboard → Authentication → Ban user.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
