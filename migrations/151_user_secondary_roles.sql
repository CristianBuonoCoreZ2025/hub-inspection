-- ═══════════════════════════════════════════════════════════════
-- Migration 151: Perfiles secundarios de usuarios
-- ═══════════════════════════════════════════════════════════════
-- Permite que un usuario con perfil principal (ej: inspector) tenga
-- perfiles secundarios (ej: adjuster, assistant, auditor) asociados
-- a uno o más clientes (companies).
-- Los perfiles secundarios NO controlan acceso a páginas (solo el
-- perfil principal lo hace). Solo sirven para aparecer en los combos
-- de asignación correspondientes.
-- "internal" NUNCA puede ser perfil secundario.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_secondary_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher')),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, role, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_secondary_roles_profile ON user_secondary_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_secondary_roles_role ON user_secondary_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_secondary_roles_company ON user_secondary_roles(company_id);

COMMENT ON TABLE user_secondary_roles IS 'Perfiles secundarios de usuarios para aparecer en combos de asignacion. No controlan acceso a paginas.';
COMMENT ON COLUMN user_secondary_roles.role IS 'Rol secundario: adjuster, inspector, assistant, auditor, dispatcher. NUNCA internal.';
COMMENT ON COLUMN user_secondary_roles.company_id IS 'Cliente al que aplica el rol secundario. NULL = aplica a todos los clientes.';

-- ═══ Función: obtener usuarios por rol para una empresa ═══
-- Trae usuarios cuyo perfil principal coincide con el rol
-- O que tienen un perfil secundario con ese rol (para la company o global)
CREATE OR REPLACE FUNCTION get_users_by_role_for_company(
  p_role TEXT,
  p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  source TEXT
)
LANGUAGE sql
STABLE
AS $$
  -- 1. Usuarios con perfil principal = p_role (de la company o sin filtro)
  SELECT p.id, p.full_name, p.email, p.role::TEXT, 'primary'::TEXT as source
  FROM profiles p
  WHERE p.is_active = true
    AND p.role::TEXT = p_role
    AND (p_company_id IS NULL OR p.company_id = p_company_id)

  UNION

  -- 2. Usuarios con perfil secundario = p_role (para la company o global/NULL)
  SELECT p.id, p.full_name, p.email, p.role::TEXT, 'secondary'::TEXT as source
  FROM profiles p
  JOIN user_secondary_roles usr ON usr.profile_id = p.id
  WHERE p.is_active = true
    AND usr.role = p_role
    AND (p_company_id IS NULL OR usr.company_id IS NULL OR usr.company_id = p_company_id)

  UNION

  -- 3. Usuarios "internal" aparecen en TODOS los combos (super-rol)
  SELECT p.id, p.full_name, p.email, p.role::TEXT, 'internal'::TEXT as source
  FROM profiles p
  WHERE p.is_active = true
    AND p.role::TEXT = 'internal'
    AND (p_company_id IS NULL OR p.company_id = p_company_id)
  ORDER BY full_name;
$$;

-- ═══ Función: obtener usuarios por múltiples roles para una empresa ═══
CREATE OR REPLACE FUNCTION get_users_by_roles_for_company(
  p_roles TEXT[],
  p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  source TEXT
)
LANGUAGE sql
STABLE
AS $$
  -- 1. Usuarios con perfil principal en p_roles
  SELECT p.id, p.full_name, p.email, p.role::TEXT, 'primary'::TEXT as source
  FROM profiles p
  WHERE p.is_active = true
    AND p.role::TEXT = ANY(p_roles)
    AND (p_company_id IS NULL OR p.company_id = p_company_id)

  UNION

  -- 2. Usuarios con perfil secundario en p_roles
  SELECT DISTINCT p.id, p.full_name, p.email, p.role::TEXT, 'secondary'::TEXT as source
  FROM profiles p
  JOIN user_secondary_roles usr ON usr.profile_id = p.id
  WHERE p.is_active = true
    AND usr.role = ANY(p_roles)
    AND (p_company_id IS NULL OR usr.company_id IS NULL OR usr.company_id = p_company_id)

  UNION

  -- 3. Usuarios "internal" aparecen en TODOS los combos (super-rol)
  SELECT p.id, p.full_name, p.email, p.role::TEXT, 'internal'::TEXT as source
  FROM profiles p
  WHERE p.is_active = true
    AND p.role::TEXT = 'internal'
    AND (p_company_id IS NULL OR p.company_id = p_company_id)
  ORDER BY full_name;
$$;

-- ═══ Trigger: updated_at ═══
CREATE OR REPLACE FUNCTION update_secondary_role_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_secondary_role_updated_at ON user_secondary_roles;
CREATE TRIGGER trg_secondary_role_updated_at
  BEFORE UPDATE ON user_secondary_roles
  FOR EACH ROW EXECUTE FUNCTION update_secondary_role_updated_at();

-- ═══ Trigger: impedir roles secundarios a usuarios "internal" ═══
CREATE OR REPLACE FUNCTION prevent_internal_secondary_roles()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_profile_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_profile_role FROM profiles WHERE id = NEW.profile_id LIMIT 1;
  IF v_profile_role = 'internal' THEN
    RAISE EXCEPTION 'Los usuarios con perfil "internal" no pueden tener roles secundarios. El perfil internal incluye todos los roles automáticamente.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_internal_sec_roles ON user_secondary_roles;
CREATE TRIGGER trg_prevent_internal_sec_roles
  BEFORE INSERT ON user_secondary_roles
  FOR EACH ROW EXECUTE FUNCTION prevent_internal_secondary_roles();

-- ═══ Trigger: si un usuario cambia a "internal", eliminar sus roles secundarios ═══
CREATE OR REPLACE FUNCTION cleanup_secondary_roles_on_internal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role::TEXT = 'internal' AND OLD.role::TEXT <> 'internal' THEN
    DELETE FROM user_secondary_roles WHERE profile_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_sec_roles_on_internal ON profiles;
CREATE TRIGGER trg_cleanup_sec_roles_on_internal
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION cleanup_secondary_roles_on_internal();

-- ═══ RLS: Row Level Security ═══
-- Habilitar RLS (Supabase lo exige en todas las tablas).
-- Policy permissive: usuarios autenticados pueden leer y escribir.
-- Las restricciones finas de acceso se manejan en la app (server actions).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_secondary_roles' AND relrowsecurity = true) THEN
    ALTER TABLE user_secondary_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_secondary_roles FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "user_secondary_roles_all" ON user_secondary_roles;
CREATE POLICY "user_secondary_roles_all" ON user_secondary_roles
  FOR ALL TO public USING (true) WITH CHECK (true);
