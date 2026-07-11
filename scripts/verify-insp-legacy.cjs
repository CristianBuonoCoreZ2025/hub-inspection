require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Ver los templates de inspeccion con sus detalles
  const templates = await c.query(`
    SELECT at.id, at.name, at.code, at.action_features_id, at.is_active, at.line_business_id,
           af.name as feature_name, af.code as feature_code,
           bl.name as line_name, bl.code_letter
    FROM action_template at
    LEFT JOIN action_features af ON at.action_features_id = af.id
    LEFT JOIN business_lines bl ON at.line_business_id = bl.id
    WHERE at.code = 'INS' OR af.code = 'INS'
    ORDER BY at.name;
  `);
  console.log('=== Templates de Inspeccion ===');
  templates.rows.forEach(t => console.log(`  ${t.id} | ${t.name} | code=${t.code} | feature=${t.feature_code} | line=${t.line_name} (${t.code_letter}) | active=${t.is_active}`));
  
  // Ver la inspeccion legacy
  const sessions = await c.query(`
    SELECT s.id, s.claim_id, s.status, s.inspection_type, s.action_template_id, s.inspection_number,
           s.claim_action_id, s.created_at,
           c.liquidation_number, c.business_line_id,
           bl.name as line_name, bl.code_letter
    FROM inspection_sessions s
    LEFT JOIN claims c ON s.claim_id = c.id
    LEFT JOIN business_lines bl ON c.business_line_id = bl.id
    ORDER BY s.created_at;
  `);
  console.log('\n=== Inspection Sessions ===');
  sessions.rows.forEach(s => console.log(`  id=${s.id.slice(0,8)} | claim=${s.claim_id.slice(0,8)} | status=${s.status} | template=${s.action_template_id} | claim_action=${s.claim_action_id} | insp_num=${s.inspection_number} | liq=${s.liquidation_number} | line=${s.code_letter}`));
  
  // Ver cuantos claim_actions hay para el claim de la inspeccion legacy
  if (sessions.rows[0]) {
    const claimId = sessions.rows[0].claim_id;
    const count = await c.query('SELECT count(*) as cnt FROM claim_actions WHERE claim_id = $1', [claimId]);
    console.log(`\n=== Claim ${claimId.slice(0,8)} tiene ${count.rows[0].cnt} claim_actions ===`);
    
    const existing = await c.query(`
      SELECT ca.code, ca.name, af.code as feature_code
      FROM claim_actions ca
      LEFT JOIN action_features af ON ca.action_features_id = af.id
      WHERE ca.claim_id = $1
      ORDER BY ca.created_on;
    `, [claimId]);
    existing.rows.forEach(a => console.log(`  ${a.code} | ${a.name} | ${a.feature_code}`));
  }
  
  c.release();
  await pool.end();
})();
