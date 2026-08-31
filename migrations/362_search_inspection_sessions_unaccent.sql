-- ============================================================
-- RPC: search_inspection_sessions_unaccent
-- Busqueda global en inspecciones (igual que search_claims_unaccent)
-- Busca en TODOS los campos de claims + participantes + inspeccion
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_inspection_sessions_unaccent(p_q text)
RETURNS TABLE(session_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET row_security TO 'off'
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT s.id AS session_id
  FROM inspection_sessions s
  LEFT JOIN claims c ON s.claim_id = c.id
  LEFT JOIN claims_participants p ON p.claim_id = c.id
  LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
  WHERE
    p_q IS NOT NULL
    AND p_q <> ''
    AND (
      -- Campos de claims
      unaccent(c.claim_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.client_reference) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.liquidation_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.internal_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.company_report_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.claim_address) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.policy_number) ILIKE unaccent('%' || p_q || '%')
      -- Campos de participantes (todos los tipos)
      OR unaccent(p.full_name) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.first_name) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.last_name) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.rut) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.address) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.city) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.commune) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.email) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.phone) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.cell_phone) ILIKE unaccent('%' || p_q || '%')
      -- Ciudad/comuna del siniestro
      OR c.city_id IN (SELECT id FROM cities WHERE unaccent(name) ILIKE unaccent('%' || p_q || '%'))
      OR c.commune_id IN (SELECT id FROM communes WHERE unaccent(name) ILIKE unaccent('%' || p_q || '%'))
      -- Campos de inspeccion
      OR unaccent(ca.code) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(s.inspection_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(s.status) ILIKE unaccent('%' || p_q || '%')
    )
$function$;
