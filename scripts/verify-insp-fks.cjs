require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  for (const table of ['inspection_evidences', 'inspection_notes', 'inspection_checklists', 'inspection_damages', 'inspection_chat_messages', 'inspection_signatures', 'damage_sketches']) {
    const fks = await c.query(`
      SELECT kcu.column_name, ccu.table_name AS ft, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = '${table}' AND tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'inspection_sessions';
    `);
    console.log(`${table} -> inspection_sessions:`);
    fks.rows.forEach(r => console.log(`  ${r.column_name} (${r.constraint_name})`));
    if (fks.rows.length === 0) console.log('  (none)');
  }
  
  c.release();
  await pool.end();
})();
