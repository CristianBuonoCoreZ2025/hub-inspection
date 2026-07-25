-- ═══════════════════════════════════════════════════════════════
-- Migration 226: Permite ver perfiles asociados a compañías compartidas
--
-- Antes: profiles solo se veía si profiles.company_id coincidía con las
--        compañías permitidas del usuario (user_clients / company_id).
--        Perfiles como Andrea Celis (internal con company_id NULL pero
--        user_clients McLarens) no aparecían en listados.
--
-- Ahora: se puede ver un perfil si el perfil objetivo comparte al menos una
--        compañía en user_clients con el usuario actual, o si su
--        profiles.company_id está permitido.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_profile_visible(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    -- El perfil objetivo tiene user_clients que el usuario actual puede ver
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
    -- O el company_id del perfil objetivo está permitido para el usuario actual
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
  )
  OR EXISTS (
    -- Fallback: internal sin user_clients ve todos los perfiles (admin sin asignar)
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'internal'
      AND NOT EXISTS (SELECT 1 FROM user_clients uc WHERE uc.user_id = p.user_id)
  );
$function$;

DROP POLICY IF EXISTS profiles_select_visible ON profiles;
CREATE POLICY profiles_select_visible ON profiles FOR SELECT TO authenticated
  USING (is_profile_visible(user_id));
