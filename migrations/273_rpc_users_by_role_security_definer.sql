-- ─────────────────────────────────────────────────────────────
-- Migración 273: Convertir get_users_by_role_for_company y
-- get_users_by_roles_for_company a SECURITY DEFINER
--
-- PROBLEMA: Estas funciones hacen SELECT FROM profiles pero NO son
-- SECURITY DEFINER, por lo que RLS sobre profiles aplica cuando se
-- ejecutan via PostgREST con anon/authenticated key. Esto hace que
-- los combos de Inspector, Liquidador, Auditor, Despachador y
-- Asistente no retornen usuarios (o retornen incompletos) cuando
-- el usuario logueado no es internal o no comparte company.
--
-- SOLUCIÓN: Marcar ambas funciones como SECURITY DEFINER para que
-- se ejecuten con los privilegios del owner (postgres), bypassando
-- RLS. Esto es seguro porque las funciones solo hacen SELECT (no
-- modifican datos) y ya tienen lógica de filtrado por company_id.
--
-- Las funciones is_profile_visible e is_tenant_allowed ya usan
-- SECURITY DEFINER, así que este patrón es consistente.
-- ─────────────────────────────────────────────────────────────

-- 1. get_users_by_role_for_company (rol único)
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
SECURITY DEFINER
SET row_security TO 'off'
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

-- 2. get_users_by_roles_for_company (múltiples roles)
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
SECURITY DEFINER
SET row_security TO 'off'
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

-- Verificar
SELECT 'get_users_by_role_for_company' as fn, prosecdef FROM pg_proc WHERE proname = 'get_users_by_role_for_company'
UNION ALL
SELECT 'get_users_by_roles_for_company', prosecdef FROM pg_proc WHERE proname = 'get_users_by_roles_for_company';
