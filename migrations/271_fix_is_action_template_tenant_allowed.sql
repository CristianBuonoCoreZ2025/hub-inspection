-- ═══════════════════════════════════════════════════════════════
-- Migration 271: Fix función is_action_template_tenant_allowed
--
-- La función referenciaba at.company_id que fue dropeada en migración 270.
-- Como action_template ya no tiene company_id (es catálogo global),
-- la función siempre devuelve true (el control de permisos lo hace
-- requirePermission en la server action).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_action_template_tenant_allowed(p_action_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET row_security TO 'off'
AS $function$
  -- action_template ya no tiene company_id (es catálogo global).
  -- El control de permisos lo hace requirePermission en la server action.
  SELECT EXISTS (
    SELECT 1
    FROM action_template at
    WHERE at.id = p_action_template_id
  );
$function$;

-- Refrescar schema cache
NOTIFY pgrst, 'reload schema';
