require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query("SELECT code, name, count(*) as n FROM lookup_catalog WHERE category = 'cancellation_reason' AND is_active = true GROUP BY code, name ORDER BY code");
  console.log("Motivos activos:");
  for (const row of r.rows) console.log(`  ${row.code}  ${row.name}  count=${row.n}`);
  const r2 = await c.query("SELECT code, name, is_active FROM lookup_catalog WHERE category = 'cancellation_reason' ORDER BY code, is_active DESC");
  console.log("\nTodos (incluye inactivos):");
  for (const row of r2.rows) console.log(`  ${row.code}  ${row.name}  active=${row.is_active}`);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
