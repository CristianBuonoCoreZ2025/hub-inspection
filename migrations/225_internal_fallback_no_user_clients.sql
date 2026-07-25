-- ═══════════════════════════════════════════════════════════════
-- Migration 225: Fallback para usuarios internal sin user_clients
--
-- - Si un internal NO tiene user_clients asignados, ve TODAS las compañías
--   (comportamiento anterior, no rompe el dashboard del admin principal).
-- - Si un internal SÍ tiene user_clients, se restringe a esas compañías.
-- - Otros roles (adjuster, inspector, etc.) siguen restringidos a user_clients
--   o profiles.company_id.
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
        OR (
          p.role = 'internal'
          AND NOT EXISTS (
            SELECT 1
            FROM user_clients uc2
            WHERE uc2.user_id = p.user_id
          )
        )
      )
  );
$function$;
