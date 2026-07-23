require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync('migrations/199_fix_duplicated_reasons.sql', 'utf8');
  await c.query(sql);
  console.log("✓ Migración 199 aplicada");
  const r = await c.query("SELECT code, name FROM lookup_catalog WHERE category = 'cancellation_reason' ORDER BY sort_order");
  console.log("\nMotivos únicos:");
  for (const row of r.rows) console.log(`  ${row.code}  ${row.name}`);
  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
