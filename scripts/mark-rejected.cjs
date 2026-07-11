require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Obtener el ID del status "rejected"
  const status = await c.query("SELECT id FROM lookup_catalog WHERE category = 'action_status' AND code = 'rejected' LIMIT 1");
  const rejectedId = status.rows[0].id;
  console.log('rejected status id:', rejectedId);
  
  // Marcar como rechazadas las gestiones indicadas
  const codes = ['HCOB-003', 'HCOB-002', 'HRES-002', 'HRES-001', 'HCOB-001'];
  for (const code of codes) {
    const res = await c.query(`
      UPDATE claim_actions 
      SET action_status_id = $1,
          issue_rejected_on = NOW(),
          issue_rejected_by = created_by,
          issuer_rejection_comment = 'Gestión rechazada desde emisión (datos legacy)'
      WHERE code LIKE '%' || $2 || '%'
        AND claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff'
      RETURNING code, action_status_id
    `, [rejectedId, code]);
    if (res.rows[0]) console.log('  Rechazada:', res.rows[0].code);
  }
  
  // Verificar
  const actions = await c.query(`
    SELECT ca.code, ls.code as status_code
    FROM claim_actions ca
    LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
    WHERE ca.claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff'
      AND ca.is_active = true
    ORDER BY ca.created_on;
  `);
  console.log('\n=== Estado final ===');
  actions.rows.forEach(a => console.log('  ' + a.code + ' | status=' + a.status_code));
  
  const rejected = actions.rows.filter(a => a.status_code === 'rejected');
  const notRejected = actions.rows.filter(a => a.status_code !== 'rejected');
  console.log('\nRechazadas:', rejected.length, '| No rechazadas:', notRejected.length);
  
  c.release();
  await pool.end();
})();
