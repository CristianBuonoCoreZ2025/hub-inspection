require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Migrar usuarios client_operator → assistant
  const r1 = await c.query("UPDATE profiles SET role = 'assistant', updated_at = now() WHERE role::TEXT = 'client_operator'");
  console.log(`✅ Usuarios migrados: ${r1.rowCount}`);

  // Eliminar permisos duplicados de client_operator que ya existen en assistant
  const r2 = await c.query(`
    DELETE FROM user_type_permissions
    WHERE user_type::TEXT = 'client_operator'
      AND section IN (
        SELECT section FROM user_type_permissions WHERE user_type::TEXT = 'assistant'
      )
  `);
  console.log(`✅ Permisos duplicados eliminados: ${r2.rowCount}`);

  // Migrar permisos restantes de client_operator → assistant
  const r3 = await c.query("UPDATE user_type_permissions SET user_type = 'assistant' WHERE user_type::TEXT = 'client_operator'");
  console.log(`✅ Permisos migrados: ${r3.rowCount}`);

  // Actualizar CHECK constraints
  await c.query("ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check");
  await c.query("ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'))");
  await c.query("ALTER TABLE user_type_permissions DROP CONSTRAINT IF EXISTS user_type_permissions_user_type_check");
  await c.query("ALTER TABLE user_type_permissions ADD CONSTRAINT user_type_permissions_user_type_check CHECK (user_type IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'))");
  console.log('✅ Constraints actualizados');

  // Verificar
  const r = await c.query("SELECT DISTINCT role::TEXT as role, COUNT(*) FROM profiles GROUP BY role::TEXT ORDER BY role");
  console.log('Distribución de roles:');
  for (const u of r.rows) console.log(`  ${u.role}: ${u.count}`);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
