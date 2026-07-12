require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Verificar action_template_claim_status (que templates estan disponibles por estado)
  const atcs = await c.query(`
    SELECT at.code as template_code, at.name as template_name,
           ls.code as status_code, ls.name as status_name,
           bl.name as line_name
    FROM action_template_claim_status atcs
    JOIN action_template at ON atcs.action_template_id = at.id
    JOIN lookup_catalog ls ON atcs.claim_status_id = ls.id
    LEFT JOIN business_lines bl ON at.line_business_id = bl.id
    WHERE atcs.is_active = true AND at.is_active = true
    ORDER BY ls.code, at.code
  `);
  console.log('=== Templates disponibles por estado ===');
  let currentStatus = '';
  atcs.rows.forEach(r => {
    if (r.status_code !== currentStatus) {
      currentStatus = r.status_code;
      console.log('\n  [' + r.status_code + '] ' + r.status_name + ':');
    }
    console.log('    ' + r.template_code + ' | ' + r.template_name + ' | line=' + (r.line_name || 'ALL'));
  });
  
  c.release();
  await pool.end();
})();
