require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const claimId = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff';

  // 1. Ver qué hay actualmente
  const r1 = await c.query("SELECT id, code, action_status_id, is_active FROM claim_actions WHERE claim_id = $1 ORDER BY id", [claimId]);
  console.log('Claim actions antes:');
  for (const row of r1.rows) console.log(`  code=${row.code} | status=${row.action_status_id} | active=${row.is_active}`);

  const r2 = await c.query("SELECT id, claim_action_id, status FROM inspection_sessions WHERE claim_id = $1", [claimId]);
  console.log(`\nInspection sessions antes: ${r2.rows.length}`);
  for (const row of r2.rows) console.log(`  id=${row.id} | claim_action_id=${row.claim_action_id} | status=${row.status}`);

  // 2. Borrar inspection_sessions
  const d1 = await c.query("DELETE FROM inspection_sessions WHERE claim_id = $1 RETURNING id", [claimId]);
  console.log(`\n✅ Inspection sessions borradas: ${d1.rowCount}`);

  // 3. Borrar claim_actions COI, INS y LIQ (incluye prefijos H)
  const d2 = await c.query("DELETE FROM claim_actions WHERE claim_id = $1 AND (code ILIKE '%COI%' OR code ILIKE '%INS%' OR code ILIKE '%LIQ%') RETURNING id, code", [claimId]);
  console.log(`✅ Claim actions COI/INS borradas: ${d2.rowCount}`);
  for (const row of d2.rows) console.log(`  ${row.code}`);

  // 4. Verificar qué quedó
  const r3 = await c.query("SELECT id, code, action_status_id, is_active FROM claim_actions WHERE claim_id = $1 ORDER BY id", [claimId]);
  console.log(`\nClaim actions después:`);
  for (const row of r3.rows) console.log(`  code=${row.code} | status=${row.action_status_id} | active=${row.is_active}`);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
