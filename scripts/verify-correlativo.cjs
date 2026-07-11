require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Buscar el claim_id correcto desde inspection_sessions
  const sessions = await c.query(`
    SELECT s.id, s.claim_id, s.claim_action_id, s.inspection_number, s.status,
           ca.code as action_code, ca.name as action_name, ca.created_on as action_created
    FROM inspection_sessions s
    LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
    ORDER BY s.created_at;
  `);
  console.log('=== Inspection Sessions ===');
  sessions.rows.forEach(s => console.log('  session=' + s.id.slice(0,8) + ' | claim=' + s.claim_id + ' | action=' + (s.claim_action_id ? s.claim_action_id.slice(0,8) : 'NULL') + ' | insp_num=' + s.inspection_number + ' | action_code=' + s.action_code));
  
  // Para cada claim_id, ver todos los claim_actions
  for (const s of sessions.rows) {
    const actions = await c.query(`
      SELECT ca.code, ca.name, ca.created_on, af.code as feature_code, at.code as template_code
      FROM claim_actions ca
      LEFT JOIN action_features af ON ca.action_features_id = af.id
      LEFT JOIN action_template at ON ca.action_template_id = at.id
      WHERE ca.claim_id = $1
      ORDER BY ca.created_on;
    `, [s.claim_id]);
    console.log('\n=== Claim ' + s.claim_id.slice(0,8) + ' — ' + actions.rows.length + ' claim_actions ===');
    actions.rows.forEach((a, i) => console.log('  ' + (i+1) + '. code=' + a.code + ' | name=' + a.name + ' | feature=' + a.feature_code + ' | template=' + a.template_code));
  }
  
  c.release();
  await pool.end();
})();
