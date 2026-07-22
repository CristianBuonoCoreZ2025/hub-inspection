require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync('migrations/196_auto_session_cancel_prior.sql', 'utf8');
  await c.query(sql);
  console.log("✓ Migración 196 aplicada");

  // Verificar sesiones existentes de L-141
  const s = await c.query(`
    SELECT s.id, s.inspection_number, s.status, s.claim_action_id,
           at.code as action_code
    FROM inspection_sessions s
    JOIN claims cl ON s.claim_id = cl.id
    LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
    LEFT JOIN action_template at ON ca.action_template_id = at.id
    WHERE cl.liquidation_number = 'L-000000141'
    ORDER BY s.created_at
  `);
  console.log(`\nSesiones de inspección de L-141 (${s.rows.length}):`);
  for (const r of s.rows) {
    console.log(`  ${r.inspection_number}  status=${r.status}  action=${r.action_code || '—'}`);
  }
  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
