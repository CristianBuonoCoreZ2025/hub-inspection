require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const sql = fs.readFileSync('migrations/135_workflow_configs.sql', 'utf8');
  const c = await pool.connect();
  try {
    await c.query(sql);
    console.log('Migration 135 applied successfully');
    
    const tables = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'workflow%'");
    console.log('\n=== Tablas creadas ===');
    tables.rows.forEach(t => console.log('  ' + t.tablename));
    
    const trigs = await c.query("SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_%workflow%' OR tgname LIKE 'trg_auto_recreate%' OR tgname LIKE 'trg_execute_workflow%'");
    console.log('\n=== Triggers ===');
    trigs.rows.forEach(t => console.log('  ' + t.tgname));
  } catch (err) { console.error('Error:', err.message); }
  finally { c.release(); await pool.end(); }
})();
