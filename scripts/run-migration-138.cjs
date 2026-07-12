require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const migrationFile = process.argv[2] || 'migrations/138_workflow_rls.sql';
  const sql = fs.readFileSync(path.resolve(migrationFile), 'utf8');

  const c = await pool.connect();
  try {
    console.log(`Aplicando ${migrationFile}...`);
    await c.query(sql);
    console.log('OK - migracion aplicada');
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    c.release();
    await pool.end();
  }
})();
