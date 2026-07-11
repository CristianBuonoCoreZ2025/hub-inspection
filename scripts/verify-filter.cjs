require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Simular el query exacto que hace getClaimActions
  const actions = await c.query(`
    SELECT ca.id, ca.code, ca.name, ca.is_active,
           ls.code as status_code, ls.name as status_name
    FROM claim_actions ca
    LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
    WHERE ca.claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff'
      AND ca.is_active = true
    ORDER BY ca.created_on DESC;
  `);
  console.log('=== Claim actions (is_active=true) ===');
  actions.rows.forEach((a, i) => console.log('  ' + (i+1) + '. code=' + a.code + ' | status=' + a.status_code + ' | name=' + a.name));
  
  // Filtrar como hace el servicio (includeRejected=false)
  const filtered = actions.rows.filter(a => a.status_code !== 'rejected');
  console.log('\n=== Filtradas (sin rejected) ===');
  filtered.forEach((a, i) => console.log('  ' + (i+1) + '. code=' + a.code + ' | status=' + a.status_code));
  console.log('Total sin rejected:', filtered.length, '/ Total:', actions.rows.length);
  
  c.release();
  await pool.end();
})();
