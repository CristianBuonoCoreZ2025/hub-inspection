require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Ver estado actual
  const r0 = await c.query("SELECT data_type, udt_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='role'");
  console.log('Estado actual de profiles.role:', JSON.stringify(r0.rows[0]));

  const r0b = await c.query("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname='user_role')");
  console.log('Existe tipo user_role:', r0b.rows[0].exists);

  // Si la columna ya es TEXT (de ejecución anterior), saltar el ALTER
  if (r0.rows[0].data_type === 'USER-DEFINED') {
    // 1. Migrar usuarios
    await c.query("UPDATE profiles SET role = 'internal' WHERE role::TEXT IN ('admin', 'superadmin')");
    console.log('✅ Usuarios migrados');

    // 2. Dropear triggers
    await c.query("DROP TRIGGER IF EXISTS trg_cleanup_sec_roles_on_internal ON profiles");
    await c.query("DROP FUNCTION IF EXISTS cleanup_secondary_roles_on_internal() CASCADE");
    console.log('✅ Triggers dropeados');

    // 3. Dropear constraints
    await c.query("ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check");
    await c.query("ALTER TABLE user_type_permissions DROP CONSTRAINT IF EXISTS user_type_permissions_user_type_check");
    console.log('✅ Constraints dropeados');

    // 4. Convertir a TEXT
    await c.query("ALTER TABLE profiles ALTER COLUMN role TYPE TEXT");
    console.log('✅ Columna convertida a TEXT');
  } else {
    console.log('✅ Columna ya es TEXT, saltando conversión');
  }

  // 5. Dropear y recrear enum
  await c.query("DROP TYPE IF EXISTS user_role CASCADE");
  await c.query("CREATE TYPE user_role AS ENUM ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher')");
  await c.query("ALTER TABLE profiles ALTER COLUMN role TYPE user_role USING role::user_role");
  await c.query("ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'adjuster'");
  console.log('✅ Enum recreado y columna restaurada');

  // 6. Recrear constraints
  await c.query("ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check");
  await c.query("ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'))");
  await c.query("ALTER TABLE user_type_permissions DROP CONSTRAINT IF EXISTS user_type_permissions_user_type_check");
  await c.query("ALTER TABLE user_type_permissions ADD CONSTRAINT user_type_permissions_user_type_check CHECK (user_type IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'))");
  console.log('✅ Constraints recreados');

  // 7. Crear trigger unificado
  await c.query("DROP TRIGGER IF EXISTS trg_cleanup_sec_roles_on_role_change ON profiles");
  await c.query("DROP FUNCTION IF EXISTS cleanup_secondary_roles_on_role_change() CASCADE");
  await c.query(`
    CREATE OR REPLACE FUNCTION cleanup_secondary_roles_on_role_change()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        DELETE FROM user_secondary_roles WHERE profile_id = NEW.id;
        IF NEW.role = 'internal' THEN
          DELETE FROM user_clients WHERE user_id = NEW.user_id;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  await c.query(`
    CREATE TRIGGER trg_cleanup_sec_roles_on_role_change
    AFTER UPDATE OF role ON profiles
    FOR EACH ROW EXECUTE FUNCTION cleanup_secondary_roles_on_role_change()
  `);
  console.log('✅ Trigger creado');

  // 8. Permisos base para auditor
  await c.query(`
    INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
    SELECT 'auditor', section, can_view, can_edit, can_create, can_delete
    FROM user_type_permissions WHERE user_type = 'adjuster'
    ON CONFLICT DO NOTHING
  `);
  console.log('✅ Permisos auditor creados');

  // 9. Permisos base para dispatcher
  await c.query(`
    INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
    SELECT 'dispatcher', section, can_view, can_edit, can_create, can_delete
    FROM user_type_permissions WHERE user_type = 'adjuster'
    ON CONFLICT DO NOTHING
  `);
  console.log('✅ Permisos dispatcher creados');

  // Verificar
  const r = await c.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype ORDER BY enumsortorder");
  console.log('\nEnum user_role:', r.rows.map(x => x.enumlabel).join(', '));

  const r2 = await c.query("SELECT role::TEXT as role, COUNT(*) FROM profiles GROUP BY role ORDER BY role");
  console.log('Distribución:');
  for (const u of r2.rows) console.log(`  ${u.role}: ${u.count}`);

  const r3 = await c.query("SELECT DISTINCT user_type FROM user_type_permissions ORDER BY user_type");
  console.log('user_types:', r3.rows.map(x => x.user_type).join(', '));

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
