require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const sql = fs.readFileSync('migrations/133_inspection_fixed_screen.sql', 'utf8');
  const c = await pool.connect();
  try {
    await c.query(sql);
    console.log('Migration 133 applied');
    
    const screens = await c.query('SELECT id, code, name, is_dynamic, is_active, sort_order FROM gestion_screens ORDER BY sort_order');
    console.log('\n=== Pantallas ===');
    screens.rows.forEach(s => console.log('  ' + s.code + ' | ' + s.name + ' | dynamic=' + s.is_dynamic + ' | sort=' + s.sort_order));
    
    const features = await c.query("SELECT af.code, af.name, gs.code as screen_code FROM action_features af LEFT JOIN gestion_screens gs ON af.screen_id = gs.id WHERE af.code IN ('INS', 'CIN')");
    console.log('\n=== Features ===');
    features.rows.forEach(f => console.log('  ' + f.code + ' | ' + f.name + ' | screen=' + f.screen_code));
  } catch (err) { console.error('Error:', err.message); }
  finally { c.release(); await pool.end(); }
})();
