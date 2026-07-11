require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Verify persons.ts uses correct FK hint
  // The original code uses person_addresses(...) without alias
  // PostgREST should resolve it if there's only one FK
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Test persons.ts original query (without FK hint)
  const res1 = await fetch(url + '/rest/v1/persons?select=' + encodeURIComponent('id, person_addresses(id, person_id, address)') + '&limit=1', {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const d1 = await res1.json();
  console.log('persons.ts original (no hint):', res1.ok ? 'OK' : 'FAIL - ' + d1.message?.slice(0, 100));
  
  // Test claim_document_request_items without FK hint
  const res2 = await fetch(url + '/rest/v1/claim_document_requests?select=' + encodeURIComponent('id, claim_document_request_items(id, request_id, document_name)') + '&limit=1', {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const d2 = await res2.json();
  console.log('claim-documents.ts original (no hint):', res2.ok ? 'OK' : 'FAIL - ' + d2.message?.slice(0, 100));
  
  // Test reserve_coverages without FK hint
  const res3 = await fetch(url + '/rest/v1/claim_reserves?select=' + encodeURIComponent('id, reserve_coverages(id, claim_reserve_id)') + '&limit=1', {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const d3 = await res3.json();
  console.log('claim-reserves.ts reserve_coverages (no hint):', res3.ok ? 'OK' : 'FAIL - ' + d3.message?.slice(0, 100));
  
  // Test inspection_sessions without FK hint (on claims)
  const res4 = await fetch(url + '/rest/v1/claims?select=' + encodeURIComponent('id, inspection_sessions(id, status)') + '&limit=1', {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const d4 = await res4.json();
  console.log('claims.ts inspection_sessions (no hint):', res4.ok ? 'OK' : 'FAIL - ' + d4.message?.slice(0, 100));
  
  // Test action_template without FK hint (on claim_actions)
  const res5 = await fetch(url + '/rest/v1/claim_actions?select=' + encodeURIComponent('id, action_template(id, name, code)') + '&limit=1', {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const d5 = await res5.json();
  console.log('claim-actions.ts action_template (no hint):', res5.ok ? 'OK' : 'FAIL - ' + d5.message?.slice(0, 100));
  
  c.release();
  await pool.end();
})();
