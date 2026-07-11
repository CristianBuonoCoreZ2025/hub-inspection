require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  const features = await c.query(`
    SELECT af.id, af.name, af.code, af.has_specific_screen, af.has_issue, af.has_review, af.has_approve, af.screen_id
    FROM action_features af
    WHERE af.name ILIKE '%inspecc%' OR af.code ILIKE '%insp%'
    ORDER BY af.name;
  `);
  console.log('=== Action Features de Inspeccion ===');
  features.rows.forEach(f => console.log(`  ${f.id} | ${f.name} | code=${f.code} | screen=${f.has_specific_screen} | issue=${f.has_issue} | review=${f.has_review} | approve=${f.has_approve}`));
  
  const templates = await c.query(`
    SELECT at.id, at.name, at.code, at.action_features_id, at.is_active,
           af.name as feature_name, af.code as feature_code
    FROM action_template at
    LEFT JOIN action_features af ON at.action_features_id = af.id
    WHERE at.name ILIKE '%inspecc%' OR at.code ILIKE '%INSP%' OR af.name ILIKE '%inspecc%'
    ORDER BY at.name;
  `);
  console.log('\n=== Action Templates de Inspeccion ===');
  templates.rows.forEach(t => console.log(`  ${t.id} | ${t.name} | code=${t.code} | feature=${t.feature_name} | active=${t.is_active}`));
  
  const actions = await c.query(`
    SELECT ca.id, ca.name, ca.code, ca.claim_id,
           af.name as feature_name
    FROM claim_actions ca
    LEFT JOIN action_features af ON ca.action_features_id = af.id
    WHERE ca.name ILIKE '%inspecc%' OR af.name ILIKE '%inspecc%'
    ORDER BY ca.created_on DESC LIMIT 5;
  `);
  console.log('\n=== Claim Actions de Inspeccion ===');
  if (actions.rows.length === 0) console.log('  NO HAY — las inspecciones no crean claim_actions');
  else actions.rows.forEach(a => console.log(`  ${a.id} | ${a.name} | code=${a.code} | feature=${a.feature_name}`));
  
  const sessions = await c.query(`
    SELECT id, claim_id, status, inspection_type, action_template_id, inspection_number
    FROM inspection_sessions ORDER BY created_at DESC LIMIT 5;
  `);
  console.log('\n=== Inspection Sessions ===');
  sessions.rows.forEach(s => console.log(`  ${s.id} | status=${s.status} | type=${s.inspection_type} | template=${s.action_template_id} | num=${s.inspection_number}`));
  
  const sampleActions = await c.query(`
    SELECT ca.code, ca.name, af.name as feature_name
    FROM claim_actions ca
    LEFT JOIN action_features af ON ca.action_features_id = af.id
    ORDER BY ca.created_on DESC LIMIT 5;
  `);
  console.log('\n=== Sample claim_actions codes (estandar) ===');
  sampleActions.rows.forEach(a => console.log(`  code=${a.code} | name=${a.name} | feature=${a.feature_name}`));
  
  c.release();
  await pool.end();
})();
