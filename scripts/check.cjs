require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Sesión actual de L-141
  const s = await c.query(`
    SELECT s.id, s.inspection_number, s.status, s.inspection_type,
           s.scheduled_at, s.inspector_id, s.interviewed_name,
           s.interviewed_email, s.inspector_observations,
           s.claim_action_id
    FROM inspection_sessions s
    JOIN claims cl ON s.claim_id = cl.id
    WHERE cl.liquidation_number = 'L-000000141'
    ORDER BY s.created_at DESC LIMIT 3
  `);
  console.log(`Sesiones de L-141 (${s.rows.length}):`);
  for (const row of s.rows) {
    console.log(`  ${row.inspection_number}  status=${row.status}`);
    console.log(`    interviewed_name:  ${row.interviewed_name || 'NULL'}`);
    console.log(`    interviewed_email: ${row.interviewed_email || 'NULL'}`);
    console.log(`    observations:      ${row.inspector_observations || 'NULL'}`);
    console.log(`    scheduled_at:      ${row.scheduled_at || 'NULL'}`);
    console.log(`    inspection_type:   ${row.inspection_type}`);
  }

  // Participantes del claim
  const p = await c.query(`
    SELECT cp.type, cp.full_name, cp.email, cp.cell_phone, cp.phone, cp.is_active
    FROM claims_participants cp
    JOIN claims cl ON cp.claim_id = cl.id
    WHERE cl.liquidation_number = 'L-000000141'
    ORDER BY cp.type
  `);
  console.log(`\nParticipantes de L-141:`);
  for (const row of p.rows) {
    console.log(`  [${row.type}] ${row.full_name}  email=${row.email}  cell=${row.cell_phone}  active=${row.is_active}`);
  }

  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
