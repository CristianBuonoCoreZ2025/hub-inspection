-- ═══════════════════════════════════════════════════════════════
-- Migration 313: Un inspector asignado a una sesión ve el siniestro
--
-- Si un usuario puede ver una inspección porque es su inspector, también
-- debe poder ver los datos del siniestro asociado (referencia de dirección,
-- liquidación, asegurado, etc.) para poder realizar la inspección.
--
-- Se actualiza is_claim_accessible para que, además de los roles del siniestro,
-- también permita el acceso cuando el usuario es inspector_id de alguna
-- inspection_session vinculada al siniestro.
-- SIN borrar datos.
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
        OR EXISTS (
          SELECT 1
          FROM inspection_sessions s
          WHERE s.claim_id = p_claim_id
            AND s.inspector_id = p.id
        )
      )
  );
$$;
