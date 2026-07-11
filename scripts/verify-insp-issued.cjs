require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  const insp = await c.query(`
    SELECT ca.code, ca.action_status_id, ls.code as status_code,
           ca.issued_on, ca.issued_by, ca.issuer_id
    FROM claim_actions ca
    LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
    JOIN action_features af ON ca.action_features_id = af.id
    WHERE af.code = 'INS';
  `);
  console.log('=== Claim action de inspeccion ===');
  insp.rows.forEach(r => console.log('  code=' + r.code + ' | status=' + r.status_code + ' | issued_on=' + r.issued_on + ' | issued_by=' + r.issued_by + ' | issuer_id=' + r.issuer_id));
  
  c.release();
  await pool.end();
})();
