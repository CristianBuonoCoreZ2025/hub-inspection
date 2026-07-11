require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  for (const table of ['characteristic_screen', 'claims_participants', 'claim_actions']) {
    const fks = await c.query(`
      SELECT kcu.column_name, ccu.table_name AS ft, ccu.column_name AS fc, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = '${table}' AND tc.constraint_type = 'FOREIGN KEY';
    `);
    console.log(`${table} FKs:`);
    fks.rows.forEach(r => console.log(`  ${r.column_name} -> ${r.ft}.${r.fc} (${r.constraint_name})`));
    if (fks.rows.length === 0) {
      const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position;`);
      console.log('  columns:', cols.rows.map(r => r.column_name).join(', '));
    }
    console.log('');
  }
  
  // Check if profiles has a relationship to user_clients (via user_id)
  const profilesFks = await c.query(`
    SELECT kcu.column_name, ccu.table_name AS ft, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'profiles' AND tc.constraint_type = 'FOREIGN KEY';
  `);
  console.log('profiles FKs:');
  profilesFks.rows.forEach(r => console.log(`  ${r.column_name} -> ${r.ft} (${r.constraint_name})`));
  
  c.release();
  await pool.end();
})();
