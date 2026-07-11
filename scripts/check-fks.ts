import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Check FKs on policies table
  const fks = await client.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'policies' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  console.log("FKs on policies table:");
  fks.rows.forEach((r) => console.log(`  ${r.column_name} → ${r.foreign_table_name}.${r.foreign_column_name}`));

  // Check if insurance_companies table exists
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('insurance_companies', 'brokers', 'business_lines', 'countries', 'companies')
  `);
  console.log("\nRelated tables:", tables.rows.map((r) => r.table_name));

  await client.end();
}

main().catch(console.error);
