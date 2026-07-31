-- ═══════════════════════════════════════════════════════════════
-- Migration 310: Acceso a siniestros e inspecciones por asignación
--
-- Un usuario solo puede ver un siniestro si está asignado en algún
-- rol del claims (assigned_adjuster, adjuster, inspector, dispatcher,
-- auditor, assistant) o si es internal.
--
-- Un usuario solo puede ver una inspección si es internal, si es el
-- inspector_id de la sesión, o si tiene acceso al siniestro asociado.
--
-- Las tablas hijas heredan la visibilidad a través de
-- is_claim_tenant_allowed e is_session_tenant_allowed.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- Funciones de acceso
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_claim_accessible(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'internal'
        OR EXISTS (
          SELECT 1
          FROM claims c
          WHERE c.id = p_claim_id
            AND (
              c.assigned_adjuster_id = p.id
              OR c.adjuster_id = p.id
              OR c.inspector_id = p.id
              OR c.dispatcher_id = p.id
              OR c.auditor_id = p.id
              OR c.assistant_id = p.id
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION is_session_accessible(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'internal'
        OR EXISTS (
          SELECT 1
          FROM inspection_sessions s
          JOIN claims c ON c.id = s.claim_id
          WHERE s.id = p_session_id
            AND (
              s.inspector_id = p.id
              OR c.assigned_adjuster_id = p.id
              OR c.adjuster_id = p.id
              OR c.dispatcher_id = p.id
              OR c.auditor_id = p.id
              OR c.assistant_id = p.id
            )
        )
      )
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- Funciones de tenant hijas (actualizadas para usar acceso)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_claim_tenant_allowed(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_claim_accessible(p_claim_id);
$$;

CREATE OR REPLACE FUNCTION is_session_tenant_allowed(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT is_session_accessible(p_session_id);
$$;

-- ═══════════════════════════════════════════════════════════════
-- Políticas SELECT de claims
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "claims_tenant_select" ON claims;

CREATE POLICY "claims_accessible_select" ON claims
  FOR SELECT
  USING (is_claim_accessible(id));

-- ═══════════════════════════════════════════════════════════════
-- Políticas SELECT de inspection_sessions
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "inspection_sessions_tenant_select" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_company_select" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_all_company" ON inspection_sessions;

CREATE POLICY "inspection_sessions_accessible_select" ON inspection_sessions
  FOR SELECT
  USING (is_session_accessible(id));

-- ═══════════════════════════════════════════════════════════════
-- Permisos de ejecución
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION
  is_claim_accessible(uuid),
  is_session_accessible(uuid),
  is_claim_tenant_allowed(uuid),
  is_session_tenant_allowed(uuid)
TO authenticated, anon;
