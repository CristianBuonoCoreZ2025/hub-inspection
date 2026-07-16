-- ═══════════════════════════════════════════════════════════════
-- Migration 153: Limpiar enum user_role + triggers de cambio de perfil
-- ═══════════════════════════════════════════════════════════════
-- 1. Migrar admin/superadmin → internal (por si acaso)
-- 2. Recrear enum user_role sin admin/superadmin/client_operator
-- 3. Trigger: al cambiar perfil principal, borrar TODOS los perfiles secundarios
-- 4. Trigger: al cambiar a internal, borrar perfiles secundarios Y user_clients
-- 5. Permisos base para auditor y dispatcher
-- ═══════════════════════════════════════════════════════════════

-- 1. Migrar usuarios admin/superadmin → internal
UPDATE profiles SET role = 'internal', updated_at = now()
WHERE role::TEXT IN ('admin', 'superadmin');

-- 2. Recrear el enum sin los valores obsoletos
-- PostgreSQL no soporta DROP VALUE, hay que recrear el tipo
-- Primero dropear triggers que referencian la columna role
DROP TRIGGER IF EXISTS trg_cleanup_sec_roles_on_internal ON profiles;
DROP FUNCTION IF EXISTS cleanup_secondary_roles_on_internal() CASCADE;

ALTER TABLE profiles ALTER COLUMN role TYPE TEXT;
DROP TYPE IF EXISTS user_role;
CREATE TYPE user_role AS ENUM ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher');
ALTER TABLE profiles ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'adjuster';

-- 3. Actualizar CHECK constraint de profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'));

-- 4. Actualizar CHECK constraint de user_type_permissions.user_type
ALTER TABLE user_type_permissions DROP CONSTRAINT IF EXISTS user_type_permissions_user_type_check;
ALTER TABLE user_type_permissions ADD CONSTRAINT user_type_permissions_user_type_check
  CHECK (user_type IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'));

-- 5. Trigger: al cambiar perfil principal, borrar TODOS los perfiles secundarios
CREATE OR REPLACE FUNCTION cleanup_secondary_roles_on_role_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Solo si el rol cambió
  IF NEW.role::TEXT IS DISTINCT FROM OLD.role::TEXT THEN
    -- Borrar todos los perfiles secundarios
    DELETE FROM user_secondary_roles WHERE profile_id = NEW.id;

    -- Si el nuevo rol es internal, borrar también la vinculación con clientes
    IF NEW.role::TEXT = 'internal' THEN
      DELETE FROM user_clients WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_sec_roles_on_role_change ON profiles;
CREATE TRIGGER trg_cleanup_sec_roles_on_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION cleanup_secondary_roles_on_role_change();

-- 6. Permisos base para auditor (hereda de adjuster)
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
SELECT 'auditor', section, can_view, can_edit, can_create, can_delete
FROM user_type_permissions
WHERE user_type::TEXT = 'adjuster'
ON CONFLICT DO NOTHING;

-- 7. Permisos base para dispatcher (hereda de adjuster)
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
SELECT 'dispatcher', section, can_view, can_edit, can_create, can_delete
FROM user_type_permissions
WHERE user_type::TEXT = 'adjuster'
ON CONFLICT DO NOTHING;
