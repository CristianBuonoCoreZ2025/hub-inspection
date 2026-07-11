require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'gestion_screens' 
    ORDER BY ordinal_position;
  `);
  console.log('=== gestion_screens columns ===');
  cols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ', nullable=' + r.is_nullable + ', default=' + r.column_default + ')'));
  
  // Ver una screen existente para ver el formato
  const sample = await c.query(`
    SELECT id, code, name, description, icon, form_schema, is_active, sort_order
    FROM gestion_screens
    WHERE code = 'coordinacion';
  `);
  console.log('\n=== Screen coordinacion (ejemplo) ===');
  if (sample.rows[0]) {
    const s = sample.rows[0];
    console.log('  id:', s.id);
    console.log('  code:', s.code);
    console.log('  name:', s.name);
    console.log('  icon:', s.icon);
    console.log('  form_schema:', JSON.stringify(s.form_schema));
    console.log('  is_active:', s.is_active);
    console.log('  sort_order:', s.sort_order);
  }
  
  c.release();
  await pool.end();
})();
