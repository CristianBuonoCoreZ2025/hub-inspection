-- ═══════════════════════════════════════════════════════════════
-- Migration 366: Dashboard agregado server-side (versión 2)
--
-- Devuelve conteos y rankings ya calculados en Postgres, respetando RLS.
-- Las funciones son SECURITY INVOKER con SET search_path = public.
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_dashboard_summary(TEXT, INT);
DROP FUNCTION IF EXISTS get_dashboard_detail(TEXT, INT, TEXT);

CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_timezone TEXT DEFAULT 'America/Santiago',
  p_recent_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_profile_id UUID;
  v_now TIMESTAMPTZ;
  v_today DATE;
  v_result JSONB;
BEGIN
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  v_now := timezone(p_timezone, now());
  v_today := v_now::date;

  SELECT jsonb_build_object(
    'claims', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE lc.code <> 'closed'),
        'closed', COUNT(*) FILTER (WHERE lc.code = 'closed'),
        'created', COUNT(*) FILTER (WHERE lc.code = 'created'),
        'adjustment', COUNT(*) FILTER (WHERE lc.code = 'adjustment'),
        'dispatchment', COUNT(*) FILTER (WHERE lc.code = 'dispatchment'),
        'reopened', COUNT(*) FILTER (WHERE lc.code = 'reopened')
      )
      FROM claims c
      LEFT JOIN lookup_catalog lc ON lc.id = c.status_id AND lc.category = 'claim_status'
      WHERE c.disabled = false
    ),
    'sessions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'scheduled', COUNT(*) FILTER (WHERE status = 'scheduled'),
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled')
      )
      FROM inspection_sessions
    ),
    'today', (
      SELECT jsonb_build_object(
        'scheduled_today', COUNT(*) FILTER (WHERE s.status = 'scheduled' AND s.scheduled_at IS NOT NULL AND timezone(p_timezone, s.scheduled_at)::date = v_today),
        'completed_today', COUNT(*) FILTER (WHERE s.status = 'completed' AND s.ended_at IS NOT NULL AND timezone(p_timezone, s.ended_at)::date = v_today),
        'inspections_today', COUNT(*) FILTER (WHERE (s.status = 'scheduled' AND timezone(p_timezone, s.scheduled_at)::date = v_today)
                                                   OR (s.status = 'completed' AND timezone(p_timezone, s.ended_at)::date = v_today)
                                                   OR (s.status = 'active' AND timezone(p_timezone, s.started_at)::date = v_today)),
        'overdue', COUNT(*) FILTER (WHERE s.status IN ('scheduled','active') AND s.scheduled_at IS NOT NULL AND timezone(p_timezone, s.scheduled_at) < v_now),
        'avg_minutes', COALESCE(AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60) FILTER (WHERE s.status = 'completed' AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL), 0)
      )
      FROM inspection_sessions s
    ),
    'top_companies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'value', t.claims, 'inspections', t.inspections) ORDER BY t.claims DESC)
      FROM (
        SELECT COALESCE(ic.id::text, 'unknown') AS id, COALESCE(ic.name, 'Sin compañía') AS name,
               COUNT(DISTINCT c.id) AS claims, COUNT(DISTINCT s.id) AS inspections
        FROM claims c
        LEFT JOIN insurance_companies ic ON ic.id = c.insurance_company_id
        LEFT JOIN inspection_sessions s ON s.claim_id = c.id
        WHERE c.disabled = false
        GROUP BY ic.id, ic.name
        ORDER BY COUNT(DISTINCT c.id) DESC
        LIMIT 6
      ) t
    ), '[]'::jsonb),
    'top_ramos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.name, 'value', t.n, 'color', t.color) ORDER BY t.n DESC)
      FROM (
        SELECT COALESCE(bl.name, ct.name, 'Sin línea de negocio') AS name, COALESCE(MAX(bl.color), '#0095DA') AS color, COUNT(*) AS n
        FROM claims c
        LEFT JOIN business_lines bl ON bl.id = c.business_line_id
        LEFT JOIN claim_types ct ON ct.id = c.claim_type_id
        WHERE c.disabled = false
        GROUP BY COALESCE(bl.name, ct.name, 'Sin línea de negocio')
        ORDER BY COUNT(*) DESC
        LIMIT 6
      ) t
    ), '[]'::jsonb),
    'top_inspectors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'total', t.total, 'completed', t.completed, 'scheduled', t.scheduled, 'active', t.active, 'avg_minutes', t.avg_minutes) ORDER BY t.completed DESC, t.total DESC)
      FROM (
        SELECT p.id, p.full_name AS name, COUNT(*) AS total,
               COUNT(*) FILTER (WHERE s.status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE s.status = 'scheduled') AS scheduled,
               COUNT(*) FILTER (WHERE s.status = 'active') AS active,
               COALESCE(AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60) FILTER (WHERE s.status = 'completed' AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL), 0) AS avg_minutes
        FROM inspection_sessions s
        LEFT JOIN profiles p ON p.id = s.inspector_id
        GROUP BY p.id, p.full_name
        ORDER BY COUNT(*) FILTER (WHERE s.status = 'completed') DESC, COUNT(*) DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'inspections_by_status', (
      SELECT jsonb_build_array(
        jsonb_build_object('name', 'Agendada', 'value', COUNT(*) FILTER (WHERE status = 'scheduled'), 'color', '#3b82f6'),
        jsonb_build_object('name', 'En curso', 'value', COUNT(*) FILTER (WHERE status = 'active'), 'color', '#f59e0b'),
        jsonb_build_object('name', 'Completada', 'value', COUNT(*) FILTER (WHERE status = 'completed'), 'color', '#10b981'),
        jsonb_build_object('name', 'Cancelada', 'value', COUNT(*) FILTER (WHERE status = 'cancelled'), 'color', '#ef4444')
      )
      FROM inspection_sessions
    ),
    'months', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', to_char(d.month_start, 'Mon'), 'value', COALESCE(c.n, 0), 'value2', COALESCE(i.n, 0)) ORDER BY d.month_start)
      FROM generate_series(date_trunc('month', v_today - interval '5 months'), date_trunc('month', v_today), interval '1 month') AS d(month_start)
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS n FROM claims
        WHERE disabled = false AND timezone(p_timezone, COALESCE(claim_date, created_at))::date BETWEEN d.month_start::date AND (d.month_start + interval '1 month' - interval '1 day')::date
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS n FROM inspection_sessions
        WHERE status = 'scheduled' AND timezone(p_timezone, scheduled_at)::date BETWEEN d.month_start::date AND (d.month_start + interval '1 month' - interval '1 day')::date
      ) i ON true
    ), '[]'::jsonb),
    'claims_by_day', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', d.name, 'value', COALESCE(c.n, 0)) ORDER BY d.dow)
      FROM (VALUES (0,'Dom'),(1,'Lun'),(2,'Mar'),(3,'Mié'),(4,'Jue'),(5,'Vie'),(6,'Sáb')) AS d(dow, name)
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS n FROM claims
        WHERE disabled = false AND extract(dow FROM timezone(p_timezone, COALESCE(claim_date, created_at)))::int = d.dow
      ) c ON true
    ), '[]'::jsonb),
    'inspections_by_day', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', d.name, 'value', COALESCE(i.n, 0)) ORDER BY d.dow)
      FROM (VALUES (0,'Dom'),(1,'Lun'),(2,'Mar'),(3,'Mié'),(4,'Jue'),(5,'Vie'),(6,'Sáb')) AS d(dow, name)
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS n FROM inspection_sessions
        WHERE COALESCE(scheduled_at, started_at, ended_at) IS NOT NULL AND extract(dow FROM timezone(p_timezone, COALESCE(scheduled_at, started_at, ended_at)))::int = d.dow
      ) i ON true
    ), '[]'::jsonb),
    'personal', (
      SELECT jsonb_build_object('total', COUNT(*), 'active', COUNT(*) FILTER (WHERE status = 'active'), 'scheduled', COUNT(*) FILTER (WHERE status = 'scheduled'), 'completed', COUNT(*) FILTER (WHERE status = 'completed'))
      FROM inspection_sessions
      WHERE v_profile_id IS NOT NULL AND inspector_id = v_profile_id
    ),
    'recent_sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'status', s.status, 'scheduled_at', s.scheduled_at, 'started_at', s.started_at, 'ended_at', s.ended_at,
        'inspector_id', s.inspector_id, 'claim_id', s.claim_id,
        'liquidation_number', s.liquidation_number, 'claim_address', s.claim_address,
        'inspection_number', COALESCE(s.inspection_number, s.action_code),
        'insured_name', (SELECT cp.full_name FROM claims_participants cp WHERE cp.claim_id = s.claim_id AND cp.type = 'insured' LIMIT 1),
        'inspector_name', (SELECT p.full_name FROM profiles p WHERE p.id = s.inspector_id LIMIT 1)
      ) ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, GREATEST(s.scheduled_at, s.started_at, s.ended_at, s.created_at) DESC NULLS LAST)
      FROM (
        SELECT s.*, c.liquidation_number, c.claim_address, ca.code AS action_code
        FROM inspection_sessions s
        JOIN claims c ON c.id = s.claim_id
        LEFT JOIN claim_actions ca ON ca.id = s.claim_action_id
        WHERE s.claim_id IS NOT NULL AND c.disabled = false
        ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, GREATEST(s.scheduled_at, s.started_at, s.ended_at, s.created_at) DESC NULLS LAST
        LIMIT p_recent_limit
      ) s
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$func$;

-- ═══════════════════════════════════════════════════════════════
-- Detalle de KPIs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_dashboard_detail(
  p_key TEXT,
  p_limit INT DEFAULT 10,
  p_timezone TEXT DEFAULT 'America/Santiago'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_profile_id UUID;
  v_now TIMESTAMPTZ;
  v_today DATE;
  v_result JSONB;
BEGIN
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  v_now := timezone(p_timezone, now());
  v_today := v_now::date;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'status', s.status, 'scheduled_at', s.scheduled_at, 'started_at', s.started_at, 'ended_at', s.ended_at,
    'inspector_id', s.inspector_id, 'claim_id', s.claim_id,
    'liquidation_number', s.liquidation_number, 'claim_address', s.claim_address,
    'inspection_number', COALESCE(s.inspection_number, s.action_code),
    'insured_name', (SELECT cp.full_name FROM claims_participants cp WHERE cp.claim_id = s.claim_id AND cp.type = 'insured' LIMIT 1),
    'inspector_name', (SELECT p.full_name FROM profiles p WHERE p.id = s.inspector_id LIMIT 1),
    'duration_minutes', EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60
  ) ORDER BY
    CASE WHEN p_key = 'avg-time' THEN EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60 ELSE 0 END DESC,
    GREATEST(s.scheduled_at, s.started_at, s.ended_at, s.created_at) DESC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT s.*, c.liquidation_number, c.claim_address, ca.code AS action_code
    FROM inspection_sessions s
    JOIN claims c ON c.id = s.claim_id
    LEFT JOIN claim_actions ca ON ca.id = s.claim_action_id
    WHERE c.disabled = false
      AND (
        (p_key = 'today' AND ((s.status = 'scheduled' AND timezone(p_timezone, s.scheduled_at)::date = v_today)
                              OR (s.status = 'completed' AND timezone(p_timezone, s.ended_at)::date = v_today)
                              OR (s.status = 'active' AND timezone(p_timezone, s.started_at)::date = v_today)))
        OR (p_key = 'active' AND s.status = 'active')
        OR (p_key = 'scheduled-today' AND s.status = 'scheduled' AND timezone(p_timezone, s.scheduled_at)::date = v_today)
        OR (p_key = 'completed-today' AND s.status = 'completed' AND timezone(p_timezone, s.ended_at)::date = v_today)
        OR (p_key = 'overdue' AND s.status IN ('scheduled','active') AND s.scheduled_at IS NOT NULL AND timezone(p_timezone, s.scheduled_at) < v_now)
        OR (p_key = 'avg-time' AND s.status = 'completed' AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL)
        OR (p_key = 'my-total' AND v_profile_id IS NOT NULL AND s.inspector_id = v_profile_id)
        OR (p_key = 'my-active' AND v_profile_id IS NOT NULL AND s.inspector_id = v_profile_id AND s.status = 'active')
        OR (p_key = 'my-scheduled' AND v_profile_id IS NOT NULL AND s.inspector_id = v_profile_id AND s.status = 'scheduled')
        OR (p_key = 'my-completed' AND v_profile_id IS NOT NULL AND s.inspector_id = v_profile_id AND s.status = 'completed')
      )
    ORDER BY
      CASE WHEN p_key = 'avg-time' THEN EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60 ELSE 0 END DESC,
      GREATEST(s.scheduled_at, s.started_at, s.ended_at, s.created_at) DESC NULLS LAST
    LIMIT p_limit
  ) s;

  RETURN v_result;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_dashboard_summary(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_detail(TEXT, INT, TEXT) TO authenticated;
