require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function login(email, password) {
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) { console.log('Login failed:', JSON.stringify(data)); return null; }
  return data.access_token;
}

async function testWithToken(token, table, select, label) {
  const res = await fetch(url + '/rest/v1/' + table + '?select=' + encodeURIComponent(select) + '&limit=3', {
    headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`OK   ${label}: ${data.length} records`);
    if (data.length > 0) console.log('     Sample:', JSON.stringify(data[0]).slice(0, 200));
    return true;
  } else {
    console.log(`FAIL ${label}: ${data.message?.slice(0, 150)}`);
    return false;
  }
}

(async () => {
  const token = await login('cristian.buono-core@mclarens.com', 'Paoloxvito099');
  if (!token) return;
  console.log('Login OK\n');
  
  // Test inspection_sessions with user token (RLS)
  const SESSION_SELECT = 'id, claim_id, status, inspection_type, scheduled_at, started_at, ended_at, magic_link_token, magic_link_expires_at, inspection_date, inspection_time, created_at, updated_at';
  
  // 1. Simple select (no embeddings)
  await testWithToken(token, 'inspection_sessions', 'id, claim_id, status, inspection_type, scheduled_at, created_at', 'inspection_sessions simple (RLS)');
  
  // 2. With embeddings
  await testWithToken(token, 'inspection_sessions', `${SESSION_SELECT}, action_template:action_template!inspection_sessions_action_template_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, inspector_id, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))`, 'inspection_sessions with embeddings (RLS)');
  
  // 3. With service role key (bypass RLS)
  const res3 = await fetch(url + '/rest/v1/inspection_sessions?select=' + encodeURIComponent('id, claim_id, status, created_at') + '&limit=3', {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const d3 = await res3.json();
  console.log(`\nService role key: ${d3.length} records`);
  if (d3.length === 0) console.log('  NO inspection_sessions in DB at all!');
  
  // 4. Check RLS policies on inspection_sessions
  console.log('\n--- Checking RLS ---');
  const { Pool } = require('pg');
  const pool = new Pool({ 
    connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  const c = await pool.connect();
  
  // Check if RLS is enabled
  const rls = await c.query(`SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'inspection_sessions';`);
  console.log('RLS enabled on inspection_sessions:', rls.rows[0]?.relrowsecurity);
  
  // Check policies
  const policies = await c.query(`
    SELECT polname, polcmd, polqual, polwithcheck 
    FROM pg_policy WHERE polrelid = 'inspection_sessions'::regclass;
  `);
  console.log('Policies:', policies.rows.length);
  policies.rows.forEach(p => {
    console.log(`  ${p.polname} (${p.polcmd})`);
    console.log(`    qual: ${p.polqual?.toString().slice(0, 200)}`);
    console.log(`    check: ${p.polwithcheck?.toString().slice(0, 200)}`);
  });
  
  // Count total sessions
  const count = await c.query('SELECT count(*) FROM inspection_sessions;');
  console.log('Total inspection_sessions in DB:', count.rows[0].count);
  
  c.release();
  await pool.end();
})();
