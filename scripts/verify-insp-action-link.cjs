require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // All columns in inspection_sessions
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'inspection_sessions' 
    ORDER BY ordinal_position;
  `);
  console.log('=== inspection_sessions columns ===');
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`));
  
  // Check if claim_action_id exists
  const hasClaimActionId = cols.rows.some(r => r.column_name === 'claim_action_id');
  console.log(`\nclaim_action_id exists: ${hasClaimActionId}`);
  
  // Check the trigger that generates claim_action codes
  const triggers = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'claim_actions'
    ORDER BY trigger_name;
  `);
  console.log('\n=== Triggers on claim_actions ===');
  triggers.rows.forEach(t => console.log(`  ${t.trigger_name} (${t.event_manipulation}): ${t.action_statement?.slice(0, 100)}`));
  
  // Check the function set_claim_action_code
  const func = await c.query(`
    SELECT pg_get_functiondef(oid) as definition
    FROM pg_proc 
    WHERE proname = 'set_claim_action_code';
  `);
  if (func.rows[0]) {
    console.log('\n=== set_claim_action_code function ===');
    console.log(func.rows[0].definition.slice(0, 500));
  }
  
  // Check action_status codes
  const statuses = await c.query(`
    SELECT id, code, name FROM lookup_catalog 
    WHERE category = 'action_status' ORDER BY sort_order;
  `);
  console.log('\n=== action_status codes ===');
  statuses.rows.forEach(s => console.log(`  ${s.code} | ${s.name} | ${s.id}`));
  
  c.release();
  await pool.end();
})();
