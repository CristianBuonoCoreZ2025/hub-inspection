require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Re-aplicar migración 198 (sin duplicados en inspector_observations)
  const sql = fs.readFileSync('migrations/198_cin_ins_deep_link.sql', 'utf8');
  await c.query(sql);
  console.log("✓ Migración 198 re-aplicada (sin duplicados)");

  // Borrar TODAS las inspecciones y documentos
  const tables = [
    'inspection_evidences', 'inspection_checklists', 'inspection_damages',
    'inspection_signatures', 'inspection_reports', 'inspection_notes',
    'inspection_chat_messages', 'damage_sketches'
  ];
  for (const t of tables) {
    try {
      const r = await c.query(`DELETE FROM ${t}`);
      console.log(`✓ ${t}: ${r.rowCount} filas borradas`);
    } catch (e) {
      console.log(`⚠ ${t}: ${e.message}`);
    }
  }
  const sess = await c.query('DELETE FROM inspection_sessions');
  console.log(`✓ inspection_sessions: ${sess.rowCount} sesiones borradas`);

  // Resetear gestiones de L-141
  const claimId = (await c.query("SELECT id FROM claims WHERE liquidation_number = 'L-000000141'")).rows[0].id;
  await c.query('DELETE FROM claim_actions WHERE claim_id = $1', [claimId]);
  await c.query('SELECT * FROM sync_workflow_for_claim($1)', [claimId]);
  await c.query('SELECT * FROM refresh_pristine_snapshots($1)', [claimId]);
  console.log(`✓ L-141 reseteado`);

  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
