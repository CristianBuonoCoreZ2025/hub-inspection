require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const sql = fs.readFileSync('migrations/136_workflow_final.sql', 'utf8');
  const c = await pool.connect();
  try {
    await c.query(sql);
    console.log('Migration 136 applied');
    
    // Verificar origin en claim_actions
    const cols = await c.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='claim_actions' AND column_name='origin'");
    console.log('origin column:', cols.rows[0]);
    
    // Verificar depends_on_template_id en workflow_steps
    const cols2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='workflow_steps' AND column_name='depends_on_template_id'");
    console.log('depends_on_template_id:', cols2.rows[0]);
    
    // Verificar triggers
    const trigs = await c.query("SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_execute_workflow','trg_cascade_workflow','trg_auto_recreate_rejected')");
    console.log('\nTriggers:');
    trigs.rows.forEach(t => console.log('  ' + t.tgname));
  } catch (err) { console.error('Error:', err.message); }
  finally { c.release(); await pool.end(); }
})();
