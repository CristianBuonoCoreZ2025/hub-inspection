require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync('migrations/200_motivos_split_existing_session.sql', 'utf8');
  await c.query(sql);
  console.log("✓ Migración 200 aplicada");
  const r = await c.query("SELECT category, code, name FROM lookup_catalog WHERE category IN ('cancellation_reason_fallida', 'cancellation_reason_desistida') ORDER BY category, sort_order");
  for (const row of r.rows) console.log(`  ${row.category}  ${row.code}  ${row.name}`);
  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
