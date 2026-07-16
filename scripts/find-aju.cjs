require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  console.log('=== action_template con code AJU ===');
  const tpl = await c.query("SELECT id, code, name, is_active FROM action_template WHERE code = 'AJU' OR code LIKE 'AJU%' ORDER BY code");
  for (const r of tpl.rows) console.log(`  ${r.code} | ${r.name} | id=${r.id} | active=${r.is_active}`);

  console.log('\n=== action_features con code AJU ===');
  const feat = await c.query("SELECT id, code, name, is_active FROM action_features WHERE code = 'AJU' OR code LIKE 'AJU%' ORDER BY code");
  for (const r of feat.rows) console.log(`  ${r.code} | ${r.name} | id=${r.id} | active=${r.is_active}`);

  console.log('\n=== gestion_screens con code AJU ===');
  const scr = await c.query("SELECT id, code, name, is_active FROM gestion_screens WHERE code = 'AJU' OR code LIKE 'AJU%' ORDER BY code");
  for (const r of scr.rows) console.log(`  ${r.code} | ${r.name} | id=${r.id} | active=${r.is_active}`);

  console.log('\n=== workflow_configs con code AJU ===');
  const wf = await c.query("SELECT id, code, name, is_active FROM workflow_configs WHERE code = 'AJU' OR code LIKE 'AJU%' ORDER BY code");
  for (const r of wf.rows) console.log(`  ${r.code} | ${r.name} | id=${r.id} | active=${r.is_active}`);

  await c.end();
}
main().catch(e => console.error(e.message));
