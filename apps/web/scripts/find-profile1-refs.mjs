// Identifica todas las referencias al Profile #1 de Camilo en la BD.
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

async function countIn(table, field, id) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(field, id);
  if (error) return { table, field, error: error.message, count: null };
  return { table, field, count: count ?? 0 };
}

async function main() {
  console.log(`\n=== REFERENCIAS AL PROFILE #1 (camilo.chala@mclarens.cl) ===\n`);
  console.log(`Profile #1 ID: ${PROFILE_1}\n`);

  // claims — campos de asignación
  const claimsFields = [
    "inspector_id", "assigned_adjuster_id", "adjuster_id",
    "auditor_id", "dispatcher_id", "assistant_id",
    "updated_by", "created_by",
  ];

  console.log("--- claims ---");
  for (const f of claimsFields) {
    const r = await countIn("claims", f, PROFILE_1);
    if (r.error) {
      console.log(`  ${f}: ERROR → ${r.error}`);
    } else if (r.count > 0) {
      console.log(`  ${f}: ${r.count} filas`);
    }
  }

  // claim_actions
  console.log("\n--- claim_actions ---");
  for (const f of ["assigned_to", "created_by", "updated_by"]) {
    const r = await countIn("claim_actions", f, PROFILE_1);
    if (r.error) {
      console.log(`  ${f}: ERROR → ${r.error}`);
    } else if (r.count > 0) {
      console.log(`  ${f}: ${r.count} filas`);
    }
  }

  // inspection_sessions
  console.log("\n--- inspection_sessions ---");
  for (const f of ["inspector_id", "created_by"]) {
    const r = await countIn("inspection_sessions", f, PROFILE_1);
    if (r.error) {
      console.log(`  ${f}: ERROR → ${r.error}`);
    } else if (r.count > 0) {
      console.log(`  ${f}: ${r.count} filas`);
    }
  }

  // audit_logs
  console.log("\n--- audit_logs ---");
  for (const f of ["user_id", "created_by"]) {
    const r = await countIn("audit_logs", f, PROFILE_1);
    if (r.error) {
      console.log(`  ${f}: ERROR → ${r.error}`);
    } else if (r.count > 0) {
      console.log(`  ${f}: ${r.count} filas`);
    }
  }

  // inspection_chat_messages
  console.log("\n--- inspection_chat_messages ---");
  for (const f of ["sender_id", "created_by"]) {
    const r = await countIn("inspection_chat_messages", f, PROFILE_1);
    if (r.error) {
      console.log(`  ${f}: ERROR → ${r.error}`);
    } else if (r.count > 0) {
      console.log(`  ${f}: ${r.count} filas`);
    }
  }

  // inspection_signatures
  console.log("\n--- inspection_signatures ---");
  const rSig = await countIn("inspection_signatures", "inspector_id", PROFILE_1);
  if (rSig.error) console.log(`  inspector_id: ERROR → ${rSig.error}`);
  else if (rSig.count > 0) console.log(`  inspector_id: ${rSig.count} filas`);

  // user_clients
  console.log("\n--- user_clients ---");
  const rUC = await countIn("user_clients", "user_id", PROFILE_1);
  if (rUC.error) console.log(`  user_id: ERROR → ${rUC.error}`);
  else console.log(`  user_id: ${rUC.count} filas`);

  // user_roles
  console.log("\n--- user_roles ---");
  const rUR = await countIn("user_roles", "user_id", PROFILE_1);
  if (rUR.error) console.log(`  user_id: ERROR → ${rUR.error}`);
  else console.log(`  user_id: ${rUR.count} filas`);

  // Resumen
  console.log(`\n=== RESUMEN ===\n`);
  console.log(`Profile #1 (camilo.chala@mclarens.cl): ${PROFILE_1}`);
  console.log(`Profile #2 (sognimc@gmail.com):       ${PROFILE_2}`);
  console.log(`\nPlan: actualizar todas las referencias de Profile #1 → Profile #2`);
  console.log(`Después: soft-delete o desactivar Profile #1`);
}

main().catch((e) => { console.error(e); process.exit(1); });
