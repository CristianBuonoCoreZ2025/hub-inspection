require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // Cancelar sesión huérfana de L-141 (su claim_action fue eliminado al resetear gestiones)
  const r = await c.query(`
    UPDATE inspection_sessions
    SET status = 'cancelled',
        cancellation_notes = 'Sesión huérfana: claim_action eliminado al resetear gestiones de L-141',
        cancelled_at = now(),
        updated_at = now()
    FROM claims cl
    WHERE inspection_sessions.claim_id = cl.id
      AND cl.liquidation_number = 'L-000000141'
      AND inspection_sessions.status IN ('scheduled', 'active')
      AND inspection_sessions.claim_action_id IS NULL
    RETURNING inspection_sessions.id, inspection_sessions.inspection_number
  `);
  console.log(`✓ Sesiones huérfanas canceladas: ${r.rowCount}`);
  for (const row of r.rows) console.log(`  ${row.inspection_number}`);

  // Verificar estado final
  const s = await c.query(`
    SELECT s.inspection_number, s.status, s.claim_action_id
    FROM inspection_sessions s
    JOIN claims cl ON s.claim_id = cl.id
    WHERE cl.liquidation_number = 'L-000000141'
    ORDER BY s.created_at
  `);
  console.log(`\nSesiones de L-141 (${s.rows.length}):`);
  for (const row of s.rows) console.log(`  ${row.inspection_number}  status=${row.status}  action=${row.claim_action_id || 'NULL'}`);
  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
