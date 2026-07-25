-- ═══════════════════════════════════════════════════════════════
-- Migration 227: Perfiles visibles para administradores internal
--
-- Problema: 226 solo permitía a internal ver todos los perfiles si
--           NO tenían user_clients. Un internal con user_clients
--           asignados no podía ver usuarios recién creados sin
--           compañía, bloqueando la asignación.
-- Ahora:    Todo usuario internal ve TODOS los perfiles (switch).
--           El resto ve perfiles que compartan al menos una compañía
--           en user_clients o en profiles.company_id heredado.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_profile_visible(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    -- Switch: los administradores internal ven todos los perfiles
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'internal'
  )
  OR EXISTS (
    -- Cualquier usuario se ve a sí mismo
    SELECT 1 WHERE auth.uid() = target_user_id
  )
  OR EXISTS (
    -- El usuario objetivo comparte al menos un cliente en user_clients
    SELECT 1
    FROM user_clients target_uc
    WHERE target_uc.user_id = target_user_id
      AND target_uc.company_id IN (
        SELECT uc.company_id
        FROM user_clients uc
        WHERE uc.user_id = auth.uid()
        UNION
        SELECT p.company_id
        FROM profiles p
        WHERE p.user_id = auth.uid()
          AND p.company_id IS NOT NULL
      )
  )
  OR EXISTS (
    -- O su compañía heredada en profiles es visible para el actual
    SELECT 1
    FROM profiles target_p
    WHERE target_p.user_id = target_user_id
      AND target_p.company_id IS NOT NULL
      AND target_p.company_id IN (
        SELECT uc.company_id
        FROM user_clients uc
        WHERE uc.user_id = auth.uid()
        UNION
        SELECT p.company_id
        FROM profiles p
        WHERE p.user_id = auth.uid()
          AND p.company_id IS NOT NULL
      )
  );
$function$;

DROP POLICY IF EXISTS profiles_select_visible ON profiles;
CREATE POLICY profiles_select_visible ON profiles FOR SELECT TO authenticated
  USING (is_profile_visible(user_id));
