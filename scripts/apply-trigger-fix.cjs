require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Ejecutar migration 149 (que tiene los CREATE OR REPLACE FUNCTION ya arreglados)
  const sql149 = fs.readFileSync('migrations/149_auto_assign_responsibles.sql', 'utf8');
  await c.query(sql149);
  console.log('✅ Migration 149 re-aplicada (COALESCE en updated_by)');

  // Ejecutar migration 147 (arreglada también)
  const sql147 = fs.readFileSync('migrations/147_fix_workflow_triggers.sql', 'utf8');
  await c.query(sql147);
  console.log('✅ Migration 147 re-aplicada (COALESCE en updated_by)');

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
