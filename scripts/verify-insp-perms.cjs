require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const c = await pool.connect();
  
  // Get user profile
  const profile = await c.query(`
    SELECT p.id, p.user_id, p.email, p.full_name, p.role, p.company_id
    FROM profiles p
    WHERE p.email = 'cristian.buono-core@mclarens.com'
    LIMIT 1;
  `);
  console.log('Profile:', JSON.stringify(profile.rows[0], null, 2));
  
  if (profile.rows[0]) {
    const role = profile.rows[0].role;
    
    // Get permissions for this role
    const perms = await c.query(`
      SELECT section, can_view, can_edit, can_create, can_delete
      FROM user_type_permissions
      WHERE user_type = $1
      ORDER BY section;
    `, [role]);
    
    console.log(`\nPermissions for role "${role}" (${perms.rows.length} sections):`);
    perms.rows.forEach(p => {
      const flag = p.can_view ? 'V' : '-';
      console.log(`  [${flag}] ${p.section} (view=${p.can_view}, edit=${p.can_edit}, create=${p.can_create}, delete=${p.can_delete})`);
    });
    
    // Specifically check for inspecciones
    const insp = perms.rows.filter(p => p.section.includes('inspeccion'));
    console.log(`\nInspecciones-related permissions: ${insp.length}`);
    insp.forEach(p => console.log(`  ${p.section}: can_view=${p.can_view}`));
  }
  
  c.release();
  await pool.end();
})();
