require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Get all columns for key tables
  const tables = ['claims', 'claim_actions', 'action_template', 'action_features', 
                  'characteristic', 'inspection_sessions', 'profiles', 'claim_reserves',
                  'reserve_coverages', 'claim_coverages', 'policy_coverages', 'persons',
                  'person_addresses', 'claim_document_requests', 'claim_document_request_items',
                  'claim_action_history', 'gestion_screens', 'characteristic_screens',
                  'user_clients', 'companies', 'lookup_catalog'];
  
  const tableCols = {};
  for (const t of tables) {
    const cols = await c.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = '${t}' ORDER BY ordinal_position;
    `);
    tableCols[t] = cols.rows.map(r => r.column_name);
  }
  
  // Check specific columns that might not exist
  const checks = [
    ['claims', 'display_name'],
    ['profiles', 'display_name'],
    ['profiles', 'full_name'],
    ['claims', 'liquidation_number'],
    ['claims', 'internal_number'],
    ['claims', 'is_special_claim'],
    ['claims', 'recovery_type_legal'],
    ['claims', 'recovery_type_material'],
    ['claims', 'broker_executive'],
    ['claims', 'disabled'],
    ['claims', 'disabled_reason'],
    ['claims', 'reopened_at'],
    ['claims', 'reopened_reason'],
    ['claim_actions', 'is_automatic'],
    ['claim_actions', 'issuer_rejection_comment'],
    ['claim_actions', 'reviewer_rejection_comment'],
    ['claim_actions', 'approver_rejection_comment'],
    ['claim_actions', 'dispatcher_rejection_comment'],
    ['claim_actions', 'dispatch_rejected_by'],
    ['claim_actions', 'dispatch_rejected_on'],
  ];
  
  console.log('Column existence checks:');
  for (const [table, col] of checks) {
    const exists = tableCols[table]?.includes(col);
    console.log(`  ${exists ? 'OK' : 'MISSING'} ${table}.${col}`);
  }
  
  c.release();
  await pool.end();
})();
