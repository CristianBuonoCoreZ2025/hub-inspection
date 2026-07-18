const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Ver columnas de claim_document_request_items
  const r = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'claim_document_request_items'
    ORDER BY ordinal_position
  `);
  console.log("=== COLUMNAS claim_document_request_items ===");
  r.rows.forEach(c => console.log(`  ${c.column_name} | ${c.data_type} | nullable: ${c.is_nullable}`));

  await client.end();
}
main().catch(console.error);
