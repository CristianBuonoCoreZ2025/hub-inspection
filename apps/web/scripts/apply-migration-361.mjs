import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration = readFileSync("../../migrations/361_fix_rpc_internal_number.sql", "utf-8");

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  console.log("Aplicando migración 361 (SECURITY DEFINER)...");
  await client.query(migration);
  console.log("Migración aplicada.");

  // Dropear versiones viejas
  await client.query(`DROP FUNCTION IF EXISTS get_inspection_sessions_ordered_v3(integer, integer, text[], uuid[], text, text, text)`);
  console.log("Old uuid[] version dropped.");

  // Verificar
  const r = await client.query(`
    SELECT prosecdef, proconfig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_inspection_sessions_ordered_v3'
  `);
  console.log("security_definer:", r.rows[0]?.prosecdef, "config:", r.rows[0]?.proconfig);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
