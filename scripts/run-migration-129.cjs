require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const sql = fs.readFileSync('migrations/129_inspection_claim_action_link.sql', 'utf8');
  const c = await pool.connect();
  try {
    await c.query(sql);
    console.log('Migration 129 applied successfully');
    const col = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inspection_sessions' AND column_name = 'claim_action_id'");
    console.log('claim_action_id column exists:', col.rows.length > 0);
    const trig = await c.query("SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'inspection_sessions' AND trigger_name = 'trg_sync_inspection_claim_action'");
    console.log('Trigger exists:', trig.rows.length > 0);
  } catch (err) { console.error('Error:', err.message); }
  finally { c.release(); await pool.end(); }
})();
