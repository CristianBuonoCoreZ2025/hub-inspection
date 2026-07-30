-- ═══════════════════════════════════════════════════════════════
-- Migration 264: Políticas RLS de escritura sobre profiles
--
-- Problema: Solo existía la política de SELECT (profiles_select_visible,
--           migración 227). No había políticas FOR UPDATE / INSERT / DELETE,
--           por lo que RLS bloqueaba silenciosamente toda escritura desde
--           el cliente Supabase (JWT del usuario).
--           Síntoma: al editar un usuario desde /dashboard/users, el
--           update devolvía 0 filas y .single() lanzaba un error vacío:
--           "❌ [ERROR] Update error on profiles {}".
--
-- Solución: Crear políticas que permitan:
--   - UPDATE: el propio usuario edita su perfil, o un internal edita cualquiera.
--   - INSERT: solo internal puede crear perfiles (las invitaciones via API
--             usan service_role, pero dejamos INSERT para clientes admin).
--   - DELETE: solo internal puede eliminar perfiles.
--
-- Nota: No se borran ni modifican datos existentes. Solo se agregan
--       políticas RLS. Cumple con la REGLA #1 del proyecto.
-- ═══════════════════════════════════════════════════════════════

-- Función helper reutilizable: ¿el usuario autenticado actual es internal?
-- SECURITY DEFINER + row_security off para que la subconsulta no se
-- vea afectada por RLS de profiles (evita recursión / falsos negativos).
CREATE OR REPLACE FUNCTION public.is_current_user_internal()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'internal'
  );
$function$;

-- ---------------------------------------------------------------
-- UPDATE: el propio usuario o cualquier internal
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS profiles_update_self_or_internal ON profiles;
CREATE POLICY profiles_update_self_or_internal ON profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_current_user_internal()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_current_user_internal()
  );

-- ---------------------------------------------------------------
-- INSERT: solo internal (las invitaciones normales usan service_role
--         vía API route, pero esto cubre creación directa desde cliente)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS profiles_insert_internal ON profiles;
CREATE POLICY profiles_insert_internal ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_internal());

-- ---------------------------------------------------------------
-- DELETE: solo internal
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS profiles_delete_internal ON profiles;
CREATE POLICY profiles_delete_internal ON profiles
  FOR DELETE TO authenticated
  USING (public.is_current_user_internal());
