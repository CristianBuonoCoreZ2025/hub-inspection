import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connStr) {
    console.error("No connection string found in env (POSTGRES_URL, DATABASE_URL, SUPABASE_DB_URL)");
    process.exit(1);
  }
  const c = new Client({ connectionString: connStr });
  await c.connect();
  await c.query("NOTIFY pgrst, 'reload schema'");
  console.log("Schema cache reload notified");
  await c.end();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
