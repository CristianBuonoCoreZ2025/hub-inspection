-- ============================================================
-- Fix RPC get_inspection_sessions_ordered_v3:
-- 1. Cambiar p_inspector_filter de uuid[] a text[] (evita error "null" string)
-- 2. Filtrar por internal_number (no liquidation_number)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_inspection_sessions_ordered_v3(
  p_page integer,
  p_page_size integer,
  p_status_filter text[],
  p_inspector_filter text[],
  p_internal_number text,
  p_sort_column text,
  p_sort_dir text
)
RETURNS TABLE(id uuid, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset int;
  v_limit int;
  v_total bigint;
  v_ascending boolean;
  v_inspector_uuids uuid[];
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  v_limit := p_page_size;
  v_ascending := lower(coalesce(p_sort_dir, 'desc')) = 'asc';

  -- Convertir text[] a uuid[] solo si hay valores validos
  IF p_inspector_filter IS NOT NULL AND array_length(p_inspector_filter, 1) > 0 THEN
    SELECT array_agg(x::uuid) INTO v_inspector_uuids
    FROM unnest(p_inspector_filter) AS x
    WHERE x IS NOT NULL AND x != '' AND x != 'null';
  END IF;

  -- Contar total
  SELECT COUNT(*) INTO v_total
  FROM inspection_sessions s
  LEFT JOIN claims c ON s.claim_id = c.id
  LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
  WHERE (p_status_filter IS NULL OR array_length(p_status_filter, 1) IS NULL OR s.status = ANY(p_status_filter))
    AND (v_inspector_uuids IS NULL OR array_length(v_inspector_uuids, 1) IS NULL OR s.inspector_id = ANY(v_inspector_uuids))
    AND (p_internal_number IS NULL OR p_internal_number = '' OR c.internal_number ILIKE '%' || p_internal_number || '%' OR c.liquidation_number ILIKE '%' || p_internal_number || '%');

  -- Si no hay resultados, retornar solo el total
  IF v_total = 0 THEN
    RETURN QUERY SELECT NULL::uuid, v_total;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, v_total
  FROM inspection_sessions s
  LEFT JOIN claims c ON s.claim_id = c.id
  LEFT JOIN claim_actions ca ON s.claim_action_id = ca.id
  WHERE (p_status_filter IS NULL OR array_length(p_status_filter, 1) IS NULL OR s.status = ANY(p_status_filter))
    AND (v_inspector_uuids IS NULL OR array_length(v_inspector_uuids, 1) IS NULL OR s.inspector_id = ANY(v_inspector_uuids))
    AND (p_internal_number IS NULL OR p_internal_number = '' OR c.internal_number ILIKE '%' || p_internal_number || '%' OR c.liquidation_number ILIKE '%' || p_internal_number || '%')
  ORDER BY
    CASE WHEN (p_sort_column IS NULL OR p_sort_column = '' OR p_sort_column = 'created_at') AND v_ascending THEN s.created_at END ASC NULLS LAST,
    CASE WHEN (p_sort_column IS NULL OR p_sort_column = '' OR p_sort_column = 'created_at') AND NOT v_ascending THEN s.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'scheduled' AND v_ascending THEN s.scheduled_at END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'scheduled' AND NOT v_ascending THEN s.scheduled_at END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'status' AND v_ascending THEN s.status END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'status' AND NOT v_ascending THEN s.status END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'internal_number' AND v_ascending THEN c.liquidation_number END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'internal_number' AND NOT v_ascending THEN c.liquidation_number END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'inspection' AND v_ascending THEN ca.code END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'inspection' AND NOT v_ascending THEN ca.code END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'client_reference' AND v_ascending THEN c.client_reference END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'client_reference' AND NOT v_ascending THEN c.client_reference END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'inspector' AND v_ascending THEN s.inspector_id END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'inspector' AND NOT v_ascending THEN s.inspector_id END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'address' AND v_ascending THEN c.claim_address END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'address' AND NOT v_ascending THEN c.claim_address END DESC NULLS LAST
  LIMIT v_limit OFFSET v_offset;
END;
$function$;
