require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Verificar is_active de las claim_actions
  const actions = await c.query(`
    SELECT ca.id, ca.code, ca.name, ca.is_active, ca.action_status_id,
           ca.issuer_id, ca.issued_on, ca.issued_by,
           ls.code as status_code, ls.name as status_name,
           af.code as feature_code, at.code as template_code
    FROM claim_actions ca
    LEFT JOIN action_features af ON ca.action_features_id = af.id
    LEFT JOIN action_template at ON ca.action_template_id = at.id
    LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
    WHERE ca.claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff'
    ORDER BY ca.created_on;
  `);
  console.log('=== Claim Actions con is_active ===');
  actions.rows.forEach((a, i) => console.log('  ' + (i+1) + '. code=' + a.code + ' | active=' + a.is_active + ' | status=' + a.status_code + ' | issuer=' + a.issuer_id + ' | issued_on=' + a.issued_on + ' | feature=' + a.feature_code));
  
  // Verificar si hay errores con el query de getClaimActions
  // El query filtra is_active=true, verifiquemos cuantas pasan
  const active = actions.rows.filter(a => a.is_active);
  console.log('\nActivas:', active.length, '/ Total:', actions.rows.length);
  
  // Verificar la inspeccion
  const insp = await c.query(`
    SELECT s.id, s.status, s.claim_action_id, s.inspection_type,
           ca.code, ca.is_active, ca.action_status_id,
           ls.code as status_code
    FROM inspection_sessions s
    LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
    LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
    WHERE s.claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff';
  `);
  console.log('\n=== Inspection Session ===');
  insp.rows.forEach(s => console.log('  status=' + s.status + ' | action_code=' + s.code + ' | action_active=' + s.is_active + ' | action_status=' + s.status_code));
  
  c.release();
  await pool.end();
})();
