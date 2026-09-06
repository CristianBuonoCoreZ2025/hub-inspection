import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Ver la definición de search_claims_unaccent
  const r = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'search_claims_unaccent'
  `);

  r.rows.forEach(row => {
    console.log(row.def);
  });

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
