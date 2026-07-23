require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const claimRes = await c.query("SELECT id FROM claims WHERE liquidation_number = 'L-000000141'");
  const claimId = claimRes.rows[0].id;

  // Cancelar sesiones activas
  const cancel = await c.query(`
    UPDATE inspection_sessions SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE claim_id = $1 AND status IN ('scheduled', 'active')
  `, [claimId]);
  console.log(`✓ Sesiones canceladas: ${cancel.rowCount}`);

  // Borrar todas las gestiones
  const del = await c.query("DELETE FROM claim_actions WHERE claim_id = $1", [claimId]);
  console.log(`✓ Eliminadas ${del.rowCount} gestiones`);

  // Recrear workflow
  const sync = await c.query("SELECT * FROM sync_workflow_for_claim($1)", [claimId]);
  console.log(`\nGestiones recreadas:`);
  for (const r of sync.rows) console.log(`  ${r.name}  created=${r.created ? '✓' : '✗'}`);

  // Refrescar snapshots
  const ref = await c.query("SELECT * FROM refresh_pristine_snapshots($1)", [claimId]);
  console.log(`\nSnapshots:`);
  for (const r of ref.rows) console.log(`  ${r.template_code}  refreshed=${r.refreshed ? '✓' : '✗'}`);

  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
