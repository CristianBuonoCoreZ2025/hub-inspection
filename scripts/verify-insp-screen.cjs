require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // 1. Action features de inspeccion
  const features = await c.query(`
    SELECT af.id, af.name, af.code, af.has_specific_screen, af.screen_id,
           gs.id as screen_id, gs.code as screen_code, gs.name as screen_name
    FROM action_features af
    LEFT JOIN gestion_screens gs ON af.screen_id = gs.id
    WHERE af.code IN ('INS', 'CIN')
    ORDER BY af.name;
  `);
  console.log('=== Action Features de Inspeccion ===');
  features.rows.forEach(f => console.log('  ' + f.code + ' | ' + f.name + ' | has_screen=' + f.has_specific_screen + ' | screen_id=' + f.screen_id + ' | screen=' + (f.screen_code || 'NULL')));
  
  // 2. Todas las gestion_screens
  const screens = await c.query(`
    SELECT id, code, name, description, icon, is_active, sort_order
    FROM gestion_screens
    ORDER BY sort_order, name;
  `);
  console.log('\n=== Gestion Screens existentes ===');
  screens.rows.forEach(s => console.log('  code=' + s.code + ' | name=' + s.name + ' | active=' + s.is_active + ' | sort=' + s.sort_order));
  
  // 3. Action templates de inspeccion
  const templates = await c.query(`
    SELECT at.id, at.name, at.code, at.action_features_id, at.is_active,
           af.code as feature_code, af.screen_id as feature_screen_id
    FROM action_template at
    LEFT JOIN action_features af ON at.action_features_id = af.id
    WHERE af.code IN ('INS', 'CIN')
    ORDER BY at.name;
  `);
  console.log('\n=== Action Templates de Inspeccion ===');
  templates.rows.forEach(t => console.log('  ' + t.code + ' | ' + t.name + ' | feature=' + t.feature_code + ' | feature_screen=' + t.feature_screen_id));
  
  c.release();
  await pool.end();
})();
