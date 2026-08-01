import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.production" });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const r = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('claim_images', 'claim_documents', 'claim_action_documents')
     ORDER BY table_name, column_name`
  );

  for (const row of r.rows) {
    console.log(`${row.table_name}: ${row.column_name}`);
  }

  await client.end();
}

main();
