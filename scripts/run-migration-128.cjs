require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  try {
    await c.query(`ALTER TABLE public.action_template ADD CONSTRAINT action_template_line_business_id_fkey FOREIGN KEY (line_business_id) REFERENCES public.business_lines(id) ON DELETE SET NULL;`);
    console.log('Added FK action_template_line_business_id_fkey');
  } catch (e) {
    console.log('Error:', e.message.slice(0, 100));
  }
  
  const fks = await c.query(`
    SELECT kcu.column_name, ccu.table_name AS ft, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'action_template' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'line_business_id';
  `);
  console.log('line_business_id FK:', fks.rows.length ? fks.rows[0].constraint_name : 'NOT FOUND');
  
  c.release();
  await pool.end();
})();
