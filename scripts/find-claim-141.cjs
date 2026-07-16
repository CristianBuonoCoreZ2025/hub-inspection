require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Buscar por claim_number que termine en 141 o que contenga 141
  const r0 = await c.query("SELECT id, claim_number, client_reference FROM claims WHERE claim_number ILIKE '%141%' OR client_reference ILIKE '%141%' OR client_reference ILIKE '%291%' ORDER BY claim_number LIMIT 10");
  console.log('Claims con 141 o 291:');
  for (const row of r0.rows) console.log(`  id=${row.id} | number=${row.claim_number} | ref=${row.client_reference}`);

  // También buscar acciones con código COI
  const r1 = await c.query("SELECT ca.claim_id, c.claim_number, ca.code FROM claim_actions ca JOIN claims c ON c.id = ca.claim_id WHERE ca.code ILIKE '%COI%' ORDER BY ca.claim_id LIMIT 20");
  console.log('\nClaims con acciones COI:');
  for (const row of r1.rows) console.log(`  claim=${row.claim_number} | code=${row.code}`);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
