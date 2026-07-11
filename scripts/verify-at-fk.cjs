require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  const fks = await c.query(`
    SELECT kcu.column_name, ccu.table_name AS ft, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'action_template' AND tc.constraint_type = 'FOREIGN KEY';
  `);
  console.log('action_template FKs:');
  fks.rows.forEach(r => console.log(' ', r.column_name, '->', r.ft, '(' + r.constraint_name + ')'));
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const tests = [
    'id, action_feature:action_features!action_template_action_features_id_fkey(id, name)',
    'id, action_feature:action_features(id, name)',
  ];
  
  console.log('\nTesting queries:');
  for (const select of tests) {
    const res = await fetch(url + '/rest/v1/action_template?select=' + encodeURIComponent(select) + '&limit=1', {
      headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
    });
    const data = await res.json();
    console.log(res.ok ? 'OK' : 'FAIL', ':', select.slice(0, 80));
    if (!res.ok) console.log('  ', data.message?.slice(0, 120));
  }
  
  c.release();
  await pool.end();
})();
