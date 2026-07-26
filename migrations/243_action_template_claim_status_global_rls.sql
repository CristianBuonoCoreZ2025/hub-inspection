-- ═════════════════════════════════════════════════════════════════
-- Migration 243: is_action_template_tenant_allowed respeta templates globales
--
-- Problema: La función is_action_template_tenant_allowed(action_template_id)
-- llamaba a is_tenant_allowed(company_id) directamente. Cuando el template
-- es global (company_id IS NULL), is_tenant_allowed(null) retorna false para
-- usuarios no-internal, bloqueando toda la tabla action_template_claim_status.
--
-- Eso hacía que el modal "Nueva Gestión" del siniestro L-000000141 (y otros)
-- mostrara "No hay gestiones disponibles" aunque el workflow/config tuviera
-- templates asociados al estado del siniestro.
--
-- Solucion: La función ahora retorna true si el template es global
-- (company_id IS NULL) o si el usuario tiene acceso a la empresa del template.
-- No se modifican datos.
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_action_template_tenant_allowed(p_action_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM action_template at
    WHERE at.id = p_action_template_id
      AND (at.company_id IS NULL OR is_tenant_allowed(at.company_id))
  );
$function$;
