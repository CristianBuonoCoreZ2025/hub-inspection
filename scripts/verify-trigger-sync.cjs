require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Ver el trigger
  const trig = await c.query(`
    SELECT pg_get_triggerdef(oid) as def
    FROM pg_trigger
    WHERE tgname = 'trg_sync_inspection_claim_action';
  `);
  console.log('=== Trigger sync_inspection_claim_action ===');
  if (trig.rows[0]) console.log(trig.rows[0].def);
  
  // Ver la funcion
  const fn = await c.query(`
    SELECT pg_get_functiondef(oid) as def
    FROM pg_proc
    WHERE proname = 'sync_inspection_claim_action';
  `);
  console.log('\n=== Funcion sync_inspection_claim_action ===');
  if (fn.rows[0]) console.log(fn.rows[0].def);
  
  // Estado actual de la inspeccion
  const insp = await c.query(`
    SELECT s.id, s.status, s.claim_action_id,
           ca.code, ca.action_status_id,
           ls.code as action_status_code
    FROM inspection_sessions s
    LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
    LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
  `);
  console.log('\n=== Inspection Session ===');
  insp.rows.forEach(s => console.log('  session status=' + s.status + ' | action_code=' + s.code + ' | action_status=' + s.action_status_code));
  
  c.release();
  await pool.end();
})();
