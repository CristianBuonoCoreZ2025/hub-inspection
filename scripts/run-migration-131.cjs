require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const sql = fs.readFileSync('migrations/131_correlativo_por_template.sql', 'utf8');
  const c = await pool.connect();
  try {
    await c.query(sql);
    console.log('Migration 131 applied successfully');
    
    const actions = await c.query("SELECT ca.code, ca.name, af.code as feature_code, at.code as template_code FROM claim_actions ca LEFT JOIN action_features af ON ca.action_features_id = af.id LEFT JOIN action_template at ON ca.action_template_id = at.id WHERE ca.claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff' ORDER BY ca.created_on");
    console.log('\n=== Claim Actions despues de migracion ===');
    actions.rows.forEach((a, i) => console.log('  ' + (i+1) + '. code=' + a.code + ' | name=' + a.name + ' | feature=' + a.feature_code + ' | template=' + a.template_code));
    console.log('Total:', actions.rows.length);
    
    const sessions = await c.query("SELECT s.id, s.inspection_number, s.claim_action_id, ca.code as action_code FROM inspection_sessions s LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id");
    console.log('\n=== Inspection Sessions ===');
    sessions.rows.forEach(s => console.log('  insp_num=' + s.inspection_number + ' | action_code=' + s.action_code));
  } catch (err) { console.error('Error:', err.message); }
  finally { c.release(); await pool.end(); }
})();
