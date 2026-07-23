require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync('migrations/201_inspection_geolocation.sql', 'utf8');
  await c.query(sql);
  console.log("✓ Migración 201 aplicada");
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inspection_sessions' AND column_name LIKE 'geo_%' ORDER BY column_name");
  console.log("\nCampos geo en inspection_sessions:");
  for (const row of r.rows) console.log(`  ${row.column_name}`);
  const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'claims' AND column_name LIKE 'claim_%latitude%' OR column_name LIKE 'claim_%longitude%' ORDER BY column_name");
  console.log("\nCampos geo en claims:");
  for (const row of r2.rows) console.log(`  ${row.column_name}`);
  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
