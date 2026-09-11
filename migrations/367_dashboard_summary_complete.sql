-- ═══════════════════════════════════════════════════════════════
-- Migration 367: Dashboard agregado server-side — versión completa
--
-- Reemplaza la carga masiva de claims/sessions al navegador.
-- SECURITY DEFINER + filtro manual de acceso para evitar RLS fila a fila.
-- Devuelve TODO el objeto `stats` que hoy calcula page.tsx en el cliente,
-- más arrays de ubicación para los donuts anidados.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_timezone TEXT DEFAULT 'America/Santiago',
  p_recent_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_profile_id UUID;
  v_is_internal BOOLEAN;
  v_now TIMESTAMPTZ;
  v_today DATE;
  v_result JSONB;
BEGIN
  -- Perfil del usuario autenticado (una sola vez)
  SELECT id, COALESCE(role = 'internal', false)
  INTO v_profile_id, v_is_internal
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  v_now := timezone(p_timezone, now());
  v_today := v_now::date;

  WITH
    -- ── Claims y sessions accesibles (misma lógica que RLS, pero manual y vectorizado)
    accessible_claims AS MATERIALIZED (
      SELECT c.*
      FROM claims c
      WHERE c.disabled = false
        AND (
          v_is_internal
          OR c.assigned_adjuster_id = v_profile_id
          OR c.adjuster_id = v_profile_id
          OR c.inspector_id = v_profile_id
          OR c.dispatcher_id = v_profile_id
          OR c.auditor_id = v_profile_id
          OR c.assistant_id = v_profile_id
        )
    ),
    accessible_sessions AS MATERIALIZED (
      SELECT s.*
      FROM inspection_sessions s
      LEFT JOIN accessible_claims c ON c.id = s.claim_id
      WHERE v_is_internal
         OR s.inspector_id = v_profile_id
         OR c.id IS NOT NULL
    ),

    -- ── Conteos por estado de siniestro
    claims_status AS (
      SELECT lc.code, COUNT(*) AS n
      FROM accessible_claims c
      LEFT JOIN lookup_catalog lc ON lc.id = c.status_id AND lc.category = 'claim_status'
      GROUP BY lc.code
    ),

    -- ── Compañías top
    top_companies AS (
      SELECT COALESCE(ic.id::text, 'unknown') AS id,
             COALESCE(ic.name, 'Sin compañía') AS name,
             COUNT(DISTINCT c.id) AS claims,
             COUNT(DISTINCT s.id) AS inspections
      FROM accessible_claims c
      LEFT JOIN insurance_companies ic ON ic.id = c.insurance_company_id
      LEFT JOIN accessible_sessions s ON s.claim_id = c.id
      GROUP BY ic.id, ic.name
      ORDER BY COUNT(DISTINCT c.id) DESC
      LIMIT 6
    ),

    -- ── Ramos / líneas de negocio top
    top_ramos AS (
      SELECT COALESCE(bl.name, ct.name, 'Sin línea de negocio') AS name,
             COALESCE(MAX(bl.color), '#0095DA') AS color,
             COUNT(*) AS n
      FROM accessible_claims c
      LEFT JOIN business_lines bl ON bl.id = c.business_line_id
      LEFT JOIN claim_types ct ON ct.id = c.claim_type_id
      GROUP BY COALESCE(bl.name, ct.name, 'Sin línea de negocio')
      ORDER BY COUNT(*) DESC
      LIMIT 6
    ),

    -- ── Inspectores top
    top_inspectors AS (
      SELECT p.id, p.full_name AS name, COUNT(*) AS total,
             COUNT(*) FILTER (WHERE s.status = 'completed') AS completed,
             COUNT(*) FILTER (WHERE s.status = 'scheduled') AS scheduled,
             COUNT(*) FILTER (WHERE s.status = 'active') AS active,
             COALESCE(AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60) FILTER (WHERE s.status = 'completed' AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL), 0) AS avg_minutes
      FROM accessible_sessions s
      LEFT JOIN profiles p ON p.id = s.inspector_id
      GROUP BY p.id, p.full_name
      ORDER BY COUNT(*) FILTER (WHERE s.status = 'completed') DESC, COUNT(*) DESC
      LIMIT 10
    ),

    -- ── Ajustadores, despachadores y revisores top
    top_adjusters AS (
      SELECT p.id, p.full_name AS name, COUNT(*) AS n
      FROM accessible_claims c
      LEFT JOIN profiles p ON p.id = c.adjuster_id
      WHERE c.adjuster_id IS NOT NULL
      GROUP BY p.id, p.full_name
      ORDER BY COUNT(*) DESC
      LIMIT 6
    ),
    top_dispatchers AS (
      SELECT p.id, p.full_name AS name, COUNT(*) AS n
      FROM accessible_claims c
      LEFT JOIN profiles p ON p.id = c.dispatcher_id
      WHERE c.dispatcher_id IS NOT NULL
      GROUP BY p.id, p.full_name
      ORDER BY COUNT(*) DESC
      LIMIT 6
    ),
    top_auditors AS (
      SELECT p.id, p.full_name AS name, COUNT(*) AS n
      FROM accessible_claims c
      LEFT JOIN profiles p ON p.id = c.auditor_id
      WHERE c.auditor_id IS NOT NULL
      GROUP BY p.id, p.full_name
      ORDER BY COUNT(*) DESC
      LIMIT 6
    ),

    -- ── Tendencia mensual (últimos 6 meses)
    months AS (
      SELECT d.month_start,
             (SELECT COUNT(*) FROM accessible_claims
              WHERE COALESCE(claim_date, created_at) IS NOT NULL
                AND timezone(p_timezone, COALESCE(claim_date, created_at))::date BETWEEN d.month_start::date AND (d.month_start + interval '1 month' - interval '1 day')::date) AS claims,
             (SELECT COUNT(*) FROM accessible_sessions
              WHERE status = 'scheduled'
                AND timezone(p_timezone, scheduled_at)::date BETWEEN d.month_start::date AND (d.month_start + interval '1 month' - interval '1 day')::date) AS inspections
      FROM generate_series(date_trunc('month', v_today - interval '5 months'), date_trunc('month', v_today), interval '1 month') AS d(month_start)
    ),

    -- ── Claims por día de semana
    claims_day AS (
      SELECT extract(dow FROM timezone(p_timezone, COALESCE(claim_date, created_at)))::int AS dow, COUNT(*) AS n
      FROM accessible_claims
      WHERE COALESCE(claim_date, created_at) IS NOT NULL
      GROUP BY extract(dow FROM timezone(p_timezone, COALESCE(claim_date, created_at)))::int
    ),

    -- ── Inspecciones por día de semana
    inspections_day AS (
      SELECT extract(dow FROM timezone(p_timezone, COALESCE(scheduled_at, started_at, ended_at)))::int AS dow, COUNT(*) AS n
      FROM accessible_sessions
      WHERE COALESCE(scheduled_at, started_at, ended_at) IS NOT NULL
      GROUP BY extract(dow FROM timezone(p_timezone, COALESCE(scheduled_at, started_at, ended_at)))::int
    ),

    -- ── Inspecciones por región y comuna (estructura del donut anidado de inspecciones)
    insp_by_region AS (
      SELECT COALESCE(r.name, 'Sin región') AS region,
             COALESCE(r.country_id, ctry.id) AS country_id,
             COUNT(*) FILTER (WHERE s.status = 'scheduled') AS agendadas,
             COUNT(*) FILTER (WHERE s.status = 'active') AS enproceso,
             COUNT(*) FILTER (WHERE s.status = 'completed') AS completadas,
             COUNT(*) FILTER (WHERE s.status = 'cancelled') AS canceladas
      FROM accessible_sessions s
      JOIN accessible_claims c ON c.id = s.claim_id
      LEFT JOIN regions r ON r.id = c.region_id
      LEFT JOIN countries ctry ON ctry.id = r.country_id
      GROUP BY COALESCE(r.name, 'Sin región'), COALESCE(r.country_id, ctry.id)
    ),
    inspections_by_region AS (
      SELECT * FROM insp_by_region ORDER BY (agendadas + enproceso + completadas + canceladas) DESC LIMIT 8
    ),
    inspections_by_commune AS (
      SELECT COALESCE(cm.name, 'Sin comuna') AS region,
             COALESCE(r.name, 'Sin región') AS region_name,
             COUNT(*) FILTER (WHERE s.status = 'scheduled') AS agendadas,
             COUNT(*) FILTER (WHERE s.status = 'active') AS enproceso,
             COUNT(*) FILTER (WHERE s.status = 'completed') AS completadas,
             COUNT(*) FILTER (WHERE s.status = 'cancelled') AS canceladas
      FROM accessible_sessions s
      JOIN accessible_claims c ON c.id = s.claim_id
      LEFT JOIN communes cm ON cm.id = c.commune_id
      LEFT JOIN regions r ON r.id = c.region_id
      GROUP BY COALESCE(cm.name, 'Sin comuna'), COALESCE(r.name, 'Sin región')
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ),

    -- ── Siniestros por región
    claims_by_region AS (
      SELECT COALESCE(r.name, 'Sin región') AS name, COUNT(*) AS value
      FROM accessible_claims c
      LEFT JOIN regions r ON r.id = c.region_id
      GROUP BY COALESCE(r.name, 'Sin región')
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ),

    -- ── Tiempo promedio por inspector (top 8 más bajo / más alto según page)
    avg_time_by_inspector AS (
      SELECT p.full_name AS name,
             COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60))::int, 0) AS value
      FROM accessible_sessions s
      LEFT JOIN profiles p ON p.id = s.inspector_id
      WHERE s.status = 'completed' AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL
      GROUP BY p.full_name
      ORDER BY AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60) ASC
      LIMIT 8
    ),

    -- ── Compañías top por inspecciones
    top_companies_by_inspections AS (
      SELECT COALESCE(ic.id::text, 'unknown') AS id,
             COALESCE(ic.name, 'Sin compañía') AS name,
             COUNT(*) AS total
      FROM accessible_sessions s
      JOIN accessible_claims c ON c.id = s.claim_id
      LEFT JOIN insurance_companies ic ON ic.id = c.insurance_company_id
      GROUP BY ic.id, ic.name
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ),

    -- ── Datos crudos de ubicación para los donuts anidados
    location_inspections AS (
      SELECT COALESCE(ctry.id::text, 'unknown') AS country_id,
             COALESCE(ctry.name, 'Sin país') AS country,
             COALESCE(r.name, 'Sin región') AS region,
             COALESCE(city.name, 'Sin ciudad') AS city,
             COALESCE(cm.name, 'Sin comuna') AS commune,
             COUNT(*) FILTER (WHERE s.status = 'scheduled') AS agendadas,
             COUNT(*) FILTER (WHERE s.status = 'active') AS enproceso,
             COUNT(*) FILTER (WHERE s.status = 'completed') AS completadas,
             COUNT(*) FILTER (WHERE s.status = 'cancelled') AS canceladas
      FROM accessible_sessions s
      JOIN accessible_claims c ON c.id = s.claim_id
      LEFT JOIN regions r ON r.id = c.region_id
      LEFT JOIN countries ctry ON ctry.id = r.country_id
      LEFT JOIN communes cm ON cm.id = c.commune_id
      LEFT JOIN cities city ON city.id = cm.city_id
      GROUP BY ctry.id, ctry.name, r.name, city.name, cm.name
    ),
    location_claims AS (
      SELECT COALESCE(ctry.id::text, 'unknown') AS country_id,
             COALESCE(ctry.name, 'Sin país') AS country,
             COALESCE(r.name, 'Sin región') AS region,
             COALESCE(city.name, 'Sin ciudad') AS city,
             COALESCE(cm.name, 'Sin comuna') AS commune,
             COALESCE(bl.name, ct.name, 'Sin línea de negocio') AS business_line,
             COALESCE(MAX(bl.color), '#0095DA') AS color,
             COUNT(*) AS n
      FROM accessible_claims c
      LEFT JOIN regions r ON r.id = c.region_id
      LEFT JOIN countries ctry ON ctry.id = r.country_id
      LEFT JOIN communes cm ON cm.id = c.commune_id
      LEFT JOIN cities city ON city.id = cm.city_id
      LEFT JOIN business_lines bl ON bl.id = c.business_line_id
      LEFT JOIN claim_types ct ON ct.id = c.claim_type_id
      GROUP BY ctry.id, ctry.name, r.name, city.name, cm.name, COALESCE(bl.name, ct.name, 'Sin línea de negocio')
    ),
    countries_list AS (
      SELECT DISTINCT ctry.id::text AS id, ctry.name
      FROM accessible_claims c
      LEFT JOIN regions r ON r.id = c.region_id
      LEFT JOIN countries ctry ON ctry.id = r.country_id
      WHERE ctry.id IS NOT NULL
    )

  SELECT jsonb_build_object(
    -- ── Claims
    'totalClaims', (SELECT COUNT(*) FROM accessible_claims),
    'openClaims', (SELECT COUNT(*) FROM accessible_claims c LEFT JOIN lookup_catalog lc ON lc.id = c.status_id AND lc.category = 'claim_status' WHERE lc.code IS NULL OR lc.code <> 'closed'),
    'closedClaims', (SELECT COALESCE(SUM(n),0)::int FROM claims_status WHERE code = 'closed'),
    'createdClaims', (SELECT COALESCE(SUM(n),0)::int FROM claims_status WHERE code = 'created'),
    'adjustmentClaims', (SELECT COALESCE(SUM(n),0)::int FROM claims_status WHERE code = 'adjustment'),
    'dispatchmentClaims', (SELECT COALESCE(SUM(n),0)::int FROM claims_status WHERE code = 'dispatchment'),
    'reopenedClaims', (SELECT COALESCE(SUM(n),0)::int FROM claims_status WHERE code = 'reopened'),
    'avgResolutionDays', COALESCE((SELECT AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 86400) FROM accessible_claims c LEFT JOIN lookup_catalog lc ON lc.id = c.status_id AND lc.category = 'claim_status' WHERE lc.code = 'closed' AND c.created_at IS NOT NULL AND c.updated_at IS NOT NULL), 0),
    'closeRate', CASE WHEN (SELECT COUNT(*) FROM accessible_claims) > 0 THEN (SELECT COALESCE(SUM(n),0) FROM claims_status WHERE code = 'closed') * 100.0 / (SELECT COUNT(*) FROM accessible_claims) ELSE 0 END,
    'claimsByStatus', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', COALESCE(ls.label, cs.code, 'Desconocido'), 'value', cs.n, 'color', COALESCE(ls.color, '#64748b')) ORDER BY cs.n DESC)
      FROM claims_status cs
      LEFT JOIN (
        SELECT 'created' AS code, 'Creado' AS label, '#3b82f6' AS color
        UNION ALL SELECT 'adjustment', 'Liquidación', '#f59e0b'
        UNION ALL SELECT 'dispatchment', 'Despacho', '#8b5cf6'
        UNION ALL SELECT 'closed', 'Cerrado', '#10b981'
        UNION ALL SELECT 'reopened', 'Reabierto', '#ef4444'
      ) ls ON ls.code = cs.code
    ), '[]'::jsonb),

    -- ── Sessions
    'totalSessions', (SELECT COUNT(*) FROM accessible_sessions),
    'scheduledSessions', (SELECT COUNT(*) FROM accessible_sessions WHERE status = 'scheduled'),
    'activeSessions', (SELECT COUNT(*) FROM accessible_sessions WHERE status = 'active'),
    'completedSessions', (SELECT COUNT(*) FROM accessible_sessions WHERE status = 'completed'),
    'cancelledSessions', (SELECT COUNT(*) FROM accessible_sessions WHERE status = 'cancelled'),
    'inspectionCompletionRate', CASE WHEN (SELECT COUNT(*) FROM accessible_sessions) > 0 THEN (SELECT COUNT(*) FROM accessible_sessions WHERE status = 'completed') * 100.0 / (SELECT COUNT(*) FROM accessible_sessions) ELSE 0 END,
    'unassignedInspections', (SELECT COUNT(*) FROM accessible_sessions WHERE inspector_id IS NULL),
    'completionVsScheduledRate', CASE WHEN ((SELECT COUNT(*) FROM accessible_sessions WHERE status IN ('scheduled','completed')) > 0)
                                       THEN (SELECT COUNT(*) FROM accessible_sessions WHERE status = 'completed') * 100.0 / (SELECT COUNT(*) FROM accessible_sessions WHERE status IN ('scheduled','completed'))
                                       ELSE 0 END,

    -- ── Hoy
    'inspectionsToday', COALESCE((SELECT COUNT(*) FROM accessible_sessions s
                                  WHERE (status = 'scheduled' AND timezone(p_timezone, s.scheduled_at)::date = v_today)
                                     OR (status = 'completed' AND timezone(p_timezone, s.ended_at)::date = v_today)
                                     OR (status = 'active' AND timezone(p_timezone, s.started_at)::date = v_today)), 0),
    'scheduledToday', COALESCE((SELECT COUNT(*) FROM accessible_sessions WHERE status = 'scheduled' AND timezone(p_timezone, scheduled_at)::date = v_today), 0),
    'completedToday', COALESCE((SELECT COUNT(*) FROM accessible_sessions WHERE status = 'completed' AND timezone(p_timezone, ended_at)::date = v_today), 0),
    'overdueSessions', COALESCE((SELECT COUNT(*) FROM accessible_sessions WHERE status IN ('scheduled','active') AND scheduled_at IS NOT NULL AND timezone(p_timezone, scheduled_at) < v_now), 0),
    'avgInspectionMinutes', COALESCE((SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) FROM accessible_sessions WHERE status = 'completed' AND started_at IS NOT NULL AND ended_at IS NOT NULL), 0),

    -- ── Rankings
    'topCompanies', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'value', claims, 'inspections', inspections) ORDER BY claims DESC) FROM top_companies), '[]'::jsonb),
    'topRamos', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'value', n, 'color', color) ORDER BY n DESC) FROM top_ramos), '[]'::jsonb),
    'topAdjusters', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', n) ORDER BY n DESC) FROM top_adjusters), '[]'::jsonb),
    'topDispatchers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', n) ORDER BY n DESC) FROM top_dispatchers), '[]'::jsonb),
    'topAuditors', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', n) ORDER BY n DESC) FROM top_auditors), '[]'::jsonb),
    'topInspectors', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'total', total, 'completed', completed, 'scheduled', scheduled, 'active', active, 'avgMinutes', avg_minutes) ORDER BY completed DESC, total DESC) FROM top_inspectors), '[]'::jsonb),
    'topCompaniesByInspections', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'total', total) ORDER BY total DESC) FROM top_companies_by_inspections), '[]'::jsonb),

    -- ── Tendencias y días
    'inspectionsByStatus', (SELECT jsonb_build_array(
        jsonb_build_object('name', 'Agendada', 'value', COUNT(*) FILTER (WHERE status = 'scheduled'), 'color', '#3b82f6'),
        jsonb_build_object('name', 'En curso', 'value', COUNT(*) FILTER (WHERE status = 'active'), 'color', '#f59e0b'),
        jsonb_build_object('name', 'Completada', 'value', COUNT(*) FILTER (WHERE status = 'completed'), 'color', '#10b981'),
        jsonb_build_object('name', 'Cancelada', 'value', COUNT(*) FILTER (WHERE status = 'cancelled'), 'color', '#ef4444')
      ) FROM accessible_sessions),
    'monthsData', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', to_char(month_start, 'Mon'), 'value', claims, 'value2', inspections) ORDER BY month_start) FROM months), '[]'::jsonb),
    'claimsByDay', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', d.name, 'value', COALESCE(c.n, 0)) ORDER BY d.dow)
                             FROM (VALUES (0,'Dom'),(1,'Lun'),(2,'Mar'),(3,'Mié'),(4,'Jue'),(5,'Vie'),(6,'Sáb')) AS d(dow, name)
                             LEFT JOIN claims_day c ON c.dow = d.dow), '[]'::jsonb),
    'inspectionsByDay', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', d.name, 'value', COALESCE(i.n, 0)) ORDER BY d.dow)
                                  FROM (VALUES (0,'Dom'),(1,'Lun'),(2,'Mar'),(3,'Mié'),(4,'Jue'),(5,'Vie'),(6,'Sáb')) AS d(dow, name)
                                  LEFT JOIN inspections_day i ON i.dow = d.dow), '[]'::jsonb),

    -- ── Regiones / comunas / tiempo
    'inspectionsByRegion', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', region, 'agendadas', agendadas, 'enProceso', enproceso, 'completadas', completadas, 'canceladas', canceladas, 'country_id', country_id)
                                                       ORDER BY (agendadas + enproceso + completadas + canceladas) DESC) FROM inspections_by_region), '[]'::jsonb),
    'inspectionsByCommune', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', region, 'agendadas', agendadas, 'enProceso', enproceso, 'completadas', completadas, 'canceladas', canceladas)
                                                       ORDER BY (agendadas + enproceso + completadas + canceladas) DESC) FROM inspections_by_commune), '[]'::jsonb),
    'claimsByRegion', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value) ORDER BY value DESC) FROM claims_by_region), '[]'::jsonb),
    'avgTimeByInspector', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value) ORDER BY value ASC) FROM avg_time_by_inspector), '[]'::jsonb),

    -- ── Métricas de usuario
    'totalCompanies', (SELECT COUNT(*) FROM companies),
    'totalUsers', (SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL),
    'activeUsers', (SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL AND is_active = true),
    'myTotalSessions', COALESCE((SELECT COUNT(*) FROM accessible_sessions WHERE v_profile_id IS NOT NULL AND inspector_id = v_profile_id), 0),
    'myActiveSessions', COALESCE((SELECT COUNT(*) FROM accessible_sessions WHERE v_profile_id IS NOT NULL AND inspector_id = v_profile_id AND status = 'active'), 0),
    'myScheduledSessions', COALESCE((SELECT COUNT(*) FROM accessible_sessions WHERE v_profile_id IS NOT NULL AND inspector_id = v_profile_id AND status = 'scheduled'), 0),
    'myCompletedSessions', COALESCE((SELECT COUNT(*) FROM accessible_sessions WHERE v_profile_id IS NOT NULL AND inspector_id = v_profile_id AND status = 'completed'), 0),

    -- ── Ubicación para donuts anidados
    'inspectionsByLocation', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'countryId', country_id, 'country', country, 'region', region, 'city', city, 'commune', commune,
        'agendadas', agendadas, 'enProceso', enproceso, 'completadas', completadas, 'canceladas', canceladas
      ) ORDER BY (agendadas + enproceso + completadas + canceladas) DESC) FROM location_inspections), '[]'::jsonb),
    'claimsByLocation', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'countryId', country_id, 'country', country, 'region', region, 'city', city, 'commune', commune,
        'businessLine', business_line, 'color', color, 'count', n
      ) ORDER BY n DESC) FROM location_claims), '[]'::jsonb),
    'countries', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name) FROM countries_list), '[]'::jsonb),

    -- ── Recent sessions
    'recentSessions', COALESCE((
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
        FROM accessible_sessions s
        JOIN accessible_claims c ON c.id = s.claim_id
        LEFT JOIN claim_actions ca ON ca.id = s.claim_action_id
        WHERE s.claim_id IS NOT NULL
        ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, GREATEST(s.scheduled_at, s.started_at, s.ended_at, s.created_at) DESC NULLS LAST
        LIMIT p_recent_limit
      ) s
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$func$;

-- get_dashboard_detail se deja con el cuerpo existente; solo nos aseguramos que esté presente.
CREATE OR REPLACE FUNCTION get_dashboard_detail(
  p_key TEXT,
  p_limit INT DEFAULT 10,
  p_timezone TEXT DEFAULT 'America/Santiago'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_profile_id UUID;
  v_is_internal BOOLEAN;
  v_now TIMESTAMPTZ;
  v_today DATE;
  v_result JSONB;
BEGIN
  SELECT id, COALESCE(role = 'internal', false)
  INTO v_profile_id, v_is_internal
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

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
    JOIN (
      SELECT c.* FROM claims c
      WHERE c.disabled = false
        AND (
          v_is_internal
          OR c.assigned_adjuster_id = v_profile_id
          OR c.adjuster_id = v_profile_id
          OR c.inspector_id = v_profile_id
          OR c.dispatcher_id = v_profile_id
          OR c.auditor_id = v_profile_id
          OR c.assistant_id = v_profile_id
        )
    ) c ON c.id = s.claim_id
    LEFT JOIN claim_actions ca ON ca.id = s.claim_action_id
    WHERE v_is_internal
       OR s.inspector_id = v_profile_id
       OR c.id IS NOT NULL
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
