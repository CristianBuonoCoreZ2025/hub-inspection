import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration = readFileSync("../../migrations/362_search_inspection_sessions_unaccent.sql", "utf-8");

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log("Aplicando migración 362 (actualizada)...");
  await client.query(migration);
  console.log("Migración aplicada.");
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
