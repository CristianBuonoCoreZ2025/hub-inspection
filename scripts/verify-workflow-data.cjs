require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Paises
  const countries = await c.query('SELECT id, name FROM countries ORDER BY name LIMIT 10');
  console.log('=== Paises ===');
  countries.rows.forEach(r => console.log('  ' + r.id + ' | ' + r.name));
  
  // Lineas de negocio
  const lines = await c.query('SELECT id, name, code_letter FROM business_lines ORDER BY name');
  console.log('\n=== Lineas de Negocio ===');
  lines.rows.forEach(r => console.log('  ' + r.id + ' | ' + r.name + ' | letter=' + r.code_letter));
  
  // Eventos
  const events = await c.query('SELECT id, name FROM events ORDER BY name LIMIT 10');
  console.log('\n=== Eventos ===');
  events.rows.forEach(r => console.log('  ' + r.id + ' | ' + r.name));
  
  // Claim statuses (estados de liquidacion)
  const statuses = await c.query("SELECT id, code, name FROM lookup_catalog WHERE category = 'claim_status' ORDER BY code");
  console.log('\n=== Claim Statuses ===');
  statuses.rows.forEach(r => console.log('  ' + r.code + ' | ' + r.name + ' | id=' + r.id));
  
  // Action templates disponibles
  const templates = await c.query(`
    SELECT at.id, at.code, at.name, at.is_active, at.line_business_id,
           af.code as feature_code, bl.name as line_name
    FROM action_template at
    LEFT JOIN action_features af ON at.action_features_id = af.id
    LEFT JOIN business_lines bl ON at.line_business_id = bl.id
    WHERE at.is_active = true
    ORDER BY at.code
  `);
  console.log('\n=== Action Templates ===');
  templates.rows.forEach(r => console.log('  ' + r.code + ' | ' + r.name + ' | feature=' + r.feature_code + ' | line=' + (r.line_name || 'ALL')));
  
  c.release();
  await pool.end();
})();
