require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const claimId = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff';

  // 1. Ver qué hay antes
  const before = await c.query(`
    SELECT ca.id, ca.code, at.code as template_code, lc.code as status, ca.is_active
    FROM claim_actions ca
    JOIN action_template at ON at.id = ca.action_template_id
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = $1 AND at.code IN ('COI', 'INS')
    ORDER BY ca.created_on
  `, [claimId]);
  console.log('=== Antes ===');
  for (const r of before.rows) console.log(`  ${r.code} | template=${r.template_code} | status=${r.status} | active=${r.is_active}`);

  const sessions = await c.query(`SELECT id, status FROM inspection_sessions WHERE claim_id = $1`, [claimId]);
  console.log(`\nInspection sessions: ${sessions.rows.length}`);
  for (const s of sessions.rows) console.log(`  ${s.id} | status=${s.status}`);

  // 2. Eliminar inspection_sessions
  const delSessions = await c.query(`DELETE FROM inspection_sessions WHERE claim_id = $1 RETURNING id`, [claimId]);
  console.log(`\n✅ Inspection sessions eliminadas: ${delSessions.rows.length}`);

  // 3. Desactivar claim_actions COI e INS
  const deact = await c.query(`
    UPDATE claim_actions SET is_active = false
    WHERE claim_id = $1 AND action_template_id IN (
      SELECT id FROM action_template WHERE code IN ('COI', 'INS')
    ) AND is_active = true
    RETURNING id, code
  `, [claimId]);
  console.log(`✅ Acciones desactivadas: ${deact.rows.length}`);
  for (const r of deact.rows) console.log(`  ${r.code}`);

  // 4. Ver después
  const after = await c.query(`
    SELECT ca.code, at.code as template_code, lc.code as status, ca.is_active
    FROM claim_actions ca
    JOIN action_template at ON at.id = ca.action_template_id
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE ca.claim_id = $1 AND at.code IN ('COI', 'INS') AND ca.is_active = true
  `, [claimId]);
  console.log(`\n=== Después (activas) ===`);
  console.log(after.rows.length > 0 ? after.rows.map(r => `  ${r.code} | ${r.template_code} | ${r.status}`).join('\n') : '  Ninguna');

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
