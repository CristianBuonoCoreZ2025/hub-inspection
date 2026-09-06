import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Ver la definición de la RPC
  const r = await client.query(`
    SELECT pg_get_function_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS result,
           pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_inspection_sessions_ordered_v3'
  `);
  
  r.rows.forEach(row => {
    console.log("=== ARGS ===");
    console.log(row.args);
    console.log("\n=== DEFINITION ===");
    console.log(row.def);
  });

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
