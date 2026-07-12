require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const sql = fs.readFileSync('migrations/137_workflow_unique.sql', 'utf8');
  const c = await pool.connect();
  try {
    await c.query(sql);
    console.log('Migration 137 applied');
    
    // Verificar
    const cols = await c.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name='workflow_configs'
      ORDER BY ordinal_position
    `);
    console.log('\nColumns:');
    cols.rows.forEach(r => console.log(`  ${r.column_name} (nullable=${r.is_nullable})`));
    
    const idx = await c.query("SELECT indexname FROM pg_indexes WHERE tablename='workflow_configs'");
    console.log('\nIndexes:');
    idx.rows.forEach(r => console.log(`  ${r.indexname}`));
  } catch (err) { console.error('Error:', err.message); }
  finally { c.release(); await pool.end(); }
})();
