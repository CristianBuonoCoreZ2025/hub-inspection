require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // 1. Ver el formato del code del claim_action de inspeccion
  const actions = await c.query(`
    SELECT ca.id, ca.code, ca.name, ca.claim_id, ca.action_features_id, ca.action_template_id,
           af.name as feature_name, af.code as feature_code,
           at.name as template_name, at.code as template_code,
           c.liquidation_number, c.business_line_id,
           bl.name as line_name, bl.code_letter, bl.code_prefix
    FROM claim_actions ca
    LEFT JOIN action_features af ON ca.action_features_id = af.id
    LEFT JOIN action_template at ON ca.action_template_id = at.id
    LEFT JOIN claims c ON ca.claim_id = c.id
    LEFT JOIN business_lines bl ON c.business_line_id = bl.id
    WHERE af.code = 'INS' OR af.name ILIKE '%inspecc%'
    ORDER BY ca.created_on DESC LIMIT 5;
  `);
  console.log('=== Claim Actions de Inspeccion ===');
  actions.rows.forEach(a => console.log(`  code=${a.code} | feature=${a.feature_code} | template=${a.template_code} | liquidation=${a.liquidation_number} | line_letter=${a.code_letter} | line_prefix=${a.code_prefix}`));
  
  // 2. Ver el formato de otros claim_actions para comparar
  const others = await c.query(`
    SELECT ca.code, ca.name, af.code as feature_code, at.code as template_code,
           c.liquidation_number, bl.code_letter, bl.code_prefix
    FROM claim_actions ca
    LEFT JOIN action_features af ON ca.action_features_id = af.id
    LEFT JOIN action_template at ON ca.action_template_id = at.id
    LEFT JOIN claims c ON ca.claim_id = c.id
    LEFT JOIN business_lines bl ON c.business_line_id = bl.id
    WHERE af.code NOT IN ('INS', 'CIN') AND af.name NOT ILIKE '%inspecc%'
    ORDER BY ca.created_on DESC LIMIT 10;
  `);
  console.log('\n=== Otros Claim Actions (estandar) ===');
  others.rows.forEach(a => console.log(`  code=${a.code} | feature=${a.feature_code} | template=${a.template_code} | liquidation=${a.liquidation_number} | line_letter=${a.code_letter} | line_prefix=${a.code_prefix}`));
  
  // 3. Ver la funcion set_claim_action_code completa
  const func = await c.query(`
    SELECT pg_get_functiondef(oid) as definition
    FROM pg_proc WHERE proname = 'set_claim_action_code';
  `);
  if (func.rows[0]) {
    console.log('\n=== set_claim_action_code function ===');
    console.log(func.rows[0].definition);
  }
  
  // 4. Ver inspection_sessions y su claim_action
  const sessions = await c.query(`
    SELECT s.id, s.status, s.inspection_type, s.inspection_number, s.claim_action_id,
           ca.code as action_code, ca.action_features_id,
           af.code as feature_code
    FROM inspection_sessions s
    LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
    LEFT JOIN action_features af ON ca.action_features_id = af.id
    ORDER BY s.created_at DESC LIMIT 5;
  `);
  console.log('\n=== Inspection Sessions con claim_action ===');
  sessions.rows.forEach(s => console.log(`  status=${s.status} | insp_num=${s.inspection_number} | action_code=${s.action_code} | feature=${s.feature_code} | claim_action_id=${s.claim_action_id}`));
  
  c.release();
  await pool.end();
})();
