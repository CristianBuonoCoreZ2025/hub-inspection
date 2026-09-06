// Banea a los dos usuarios con profiles eliminados para que no puedan loguearse.
// Usa Supabase Admin Auth API con ban_duration='876000h' (100 años).
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

// user_id de auth.users (no profile.id) de los profiles a banear
const USERS_TO_BAN = [
  {
    profileId: "7b3678b8-9f21-b0d0-a3da-a2d95fdab563",
    userId: "5f1ffc4c-13e0-4fc1-87e5-2d6d0956f362",
    name: "Camilo Chala",
    email: "camilo.chala@mclarens.cl",
  },
  {
    profileId: "6e3d7a5e-d755-d7e8-fa29-f1c6770e019f",
    userId: "0825296c-419a-43b6-b21e-a9b0a6bfa8e0",
    name: "Gabriel Labra",
    email: "gabriel.labra@mclarens.cl",
  },
];

async function main() {
  console.log(`\n=== BANEO DE USUARIOS EN auth.users ===\n`);

  for (const u of USERS_TO_BAN) {
    console.log(`\n--- ${u.name} (${u.email}) ---`);
    console.log(`  user_id: ${u.userId}`);

    // Banear al usuario con duración larga (100 años = 876000h)
    const { data, error } = await supabase.auth.admin.updateUserById(u.userId, {
      ban_duration: "876000h",
    });

    if (error) {
      console.error(`  ERROR: ${error.message}`);
      // Intentar con listUsers para verificar si el user_id existe
      console.log(`  Verificando si el user_id existe en auth.users...`);
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) {
        console.error(`  No se pudo listar users: ${listErr.message}`);
      } else {
        const found = list.users.find((usr) => usr.id === u.userId);
        if (found) {
          console.log(`  User encontrado: id=${found.id} email=${found.email} banned=${found.banned_until || "no"}`);
        } else {
          console.log(`  User NO encontrado en auth.users. Puede que ya haya sido eliminado.`);
          // Buscar por email
          const byEmail = list.users.find((usr) => (usr.email || "").toLowerCase() === u.email.toLowerCase());
          if (byEmail) {
            console.log(`  Pero existe por email: id=${byEmail.id} email=${byEmail.email}`);
            // Banear ese
            console.log(`  Baneando por id encontrado por email...`);
            const { error: e2 } = await supabase.auth.admin.updateUserById(byEmail.id, {
              ban_duration: "876000h",
            });
            if (e2) {
              console.error(`  ERROR al banear: ${e2.message}`);
            } else {
              console.log(`  ✓ Usuario baneado (id=${byEmail.id})`);
            }
          }
        }
      }
    } else {
      console.log(`  ✓ Usuario baneado hasta 100 años`);
      if (data?.user) {
        console.log(`  banned_until: ${data.user.banned_until || "N/A"}`);
      }
    }
  }

  // Verificación final
  console.log(`\n${"=".repeat(80)}`);
  console.log("VERIFICACIÓN FINAL");
  console.log(`${"=".repeat(80)}\n`);

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("No se pudo listar users para verificación:", listErr.message);
    return;
  }

  for (const u of USERS_TO_BAN) {
    const found = list.users.find(
      (usr) => usr.id === u.userId || (usr.email || "").toLowerCase() === u.email.toLowerCase()
    );
    if (found) {
      const banned = found.banned_until ? `baneado hasta ${found.banned_until}` : "NO baneado";
      console.log(`  ${u.name}: email=${found.email}  ${banned}`);
    } else {
      console.log(`  ${u.name}: NO encontrado en auth.users (¿ya eliminado?)`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
