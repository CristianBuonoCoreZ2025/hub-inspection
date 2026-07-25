-- ═══════════════════════════════════════════════════════════════
-- Migration 224: is_tenant_allowed respeta user_clients para todos los roles
--
-- Antes: internal veía TODAS las compañías (role = 'internal').
-- Ahora: todo usuario (incluido internal) solo ve compañías asignadas en
--        user_clients o en profiles.company_id.
-- Además: los usuarios internal pueden gestionar user_clients sin restricción,
--         evitando catch-22 al asignar la primera compañía.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_tenant_allowed(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.company_id = p_company_id
        OR EXISTS (
          SELECT 1
          FROM user_clients uc
          WHERE uc.user_id = p.user_id
            AND uc.company_id = p_company_id
        )
      )
  );
$function$;

-- internal: ver user_clients sin depender de user_clients propios (gestión)
DROP POLICY IF EXISTS user_clients_internal_select ON user_clients;
CREATE POLICY user_clients_internal_select ON user_clients FOR SELECT TO authenticated
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'internal');

-- internal: insertar user_clients sin catch-22
DROP POLICY IF EXISTS user_clients_internal_insert ON user_clients;
CREATE POLICY user_clients_internal_insert ON user_clients FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'internal');

-- internal: actualizar user_clients
DROP POLICY IF EXISTS user_clients_internal_update ON user_clients;
CREATE POLICY user_clients_internal_update ON user_clients FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'internal')
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'internal');

-- internal: eliminar user_clients
DROP POLICY IF EXISTS user_clients_internal_delete ON user_clients;
CREATE POLICY user_clients_internal_delete ON user_clients FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'internal');
