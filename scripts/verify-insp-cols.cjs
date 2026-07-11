require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Get all columns for inspection_sessions
  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'inspection_sessions' ORDER BY ordinal_position;
  `);
  const dbCols = cols.rows.map(r => r.column_name);
  
  // Columns referenced in SESSION_SELECT
  const selectCols = [
    'id', 'claim_id', 'action_template_id', 'scheduled_at', 'started_at', 'ended_at',
    'magic_link_token', 'magic_link_expires_at', 'status', 'inspection_type',
    'inspection_date', 'inspection_time',
    'interviewed_name', 'interviewed_email', 'interviewed_relationship',
    'police_report_number', 'police_report_name', 'police_report_rut',
    'firefighters_company', 'other_insurances', 'other_insurance_company',
    'inspector_observations',
    'cancellation_reason_id', 'cancellation_notes', 'cancelled_at', 'cancelled_by',
    'active_tab', 'acta_step',
    'property_risk', 'property_materiality', 'security_measures', 'insured_statement', 'third_parties',
    'created_at', 'updated_at'
  ];
  
  console.log('Columns in SESSION_SELECT that are MISSING from DB:');
  const missing = selectCols.filter(col => !dbCols.includes(col));
  if (missing.length === 0) {
    console.log('  None - all columns exist!');
  } else {
    missing.forEach(col => console.log(`  MISSING: ${col}`));
  }
  
  console.log('\nColumns in DB that are NOT in SESSION_SELECT:');
  const extra = dbCols.filter(col => !selectCols.includes(col));
  extra.forEach(col => console.log(`  ${col}`));
  
  // Also check if 'inspection_number' column exists (used in the page)
  console.log(`\ninspection_number exists: ${dbCols.includes('inspection_number')}`);
  
  c.release();
  await pool.end();
})();
