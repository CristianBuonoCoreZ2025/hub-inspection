require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  const actions = await c.query(`
    SELECT ca.code, ca.name, ca.is_active,
           ls.code as status_code, ls.name as status_name
    FROM claim_actions ca
    LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
    ORDER BY ca.created_on;
  `);
  console.log('=== Todas las claim_actions ===');
  actions.rows.forEach((a, i) => console.log('  ' + (i+1) + '. code=' + a.code + ' | active=' + a.is_active + ' | status=' + a.status_code + ' | name=' + a.name));
  
  // Verificar si existe el status "rejected"
  const statuses = await c.query(`
    SELECT id, code, name, category FROM lookup_catalog 
    WHERE code IN ('rejected', 'todo', 'issued', 'reviewed', 'approved', 'cancelled')
    ORDER BY code;
  `);
  console.log('\n=== Status codes en lookup_catalog ===');
  statuses.rows.forEach(s => console.log('  ' + s.code + ' | ' + s.name + ' | category=' + s.category + ' | id=' + s.id));
  
  c.release();
  await pool.end();
})();
