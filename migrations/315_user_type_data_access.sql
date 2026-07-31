-- ═══════════════════════════════════════════════════════════════
-- Migration 315: Acceso a datos configurable por tipo de usuario
--
-- Dejamos de depender del nombre de rol "internal" para dar acceso total.
-- Ahora cada user_type puede tener:
--   - is_admin: acceso total (todos los siniestros, inspecciones, etc.)
--   - see_all_client_claims: acceso a todos los siniestros e inspecciones
--     de las compañías asignadas al usuario (company_id del perfil o user_clients).
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

-- Tabla de acceso a datos por tipo de usuario
CREATE TABLE IF NOT EXISTS user_type_data_access (
  user_type user_role PRIMARY KEY,
  is_admin boolean NOT NULL DEFAULT false,
  see_all_client_claims boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Semilla: internal conserva su acceso total actual
INSERT INTO user_type_data_access (user_type, is_admin, see_all_client_claims)
  SELECT 'internal', true, true
  WHERE NOT EXISTS (SELECT 1 FROM user_type_data_access WHERE user_type = 'internal');

-- Resto de perfiles quedan sin flags por defecto (acceso solo por asignación)
INSERT INTO user_type_data_access (user_type)
  SELECT v::user_role
  FROM unnest(enum_range(NULL::user_role)) AS v
  WHERE NOT EXISTS (SELECT 1 FROM user_type_data_access WHERE user_type = v)
  ON CONFLICT (user_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- is_claim_accessible: usa flags en lugar de role = 'internal'
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
    JOIN user_type_data_access d ON d.user_type = p.role
    WHERE p.user_id = auth.uid()
      AND (
        d.is_admin
        OR (
          d.see_all_client_claims
          AND EXISTS (
            SELECT 1
            FROM claims c
            WHERE c.id = p_claim_id
              AND (
                c.company_id = p.company_id
                OR EXISTS (
                  SELECT 1 FROM user_clients uc
                  WHERE uc.user_id = p.user_id
                    AND uc.company_id = c.company_id
                )
              )
          )
        )
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

-- ═══════════════════════════════════════════════════════════════
-- is_session_accessible: usa flags en lugar de role = 'internal'
-- ═══════════════════════════════════════════════════════════════
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
    JOIN user_type_data_access d ON d.user_type = p.role
    WHERE p.user_id = auth.uid()
      AND (
        d.is_admin
        OR (
          d.see_all_client_claims
          AND EXISTS (
            SELECT 1
            FROM inspection_sessions s
            JOIN claims c ON c.id = s.claim_id
            WHERE s.id = p_session_id
              AND (
                s.company_id = p.company_id
                OR c.company_id = p.company_id
                OR EXISTS (
                  SELECT 1 FROM user_clients uc
                  WHERE uc.user_id = p.user_id
                    AND (
                      uc.company_id = s.company_id
                      OR uc.company_id = c.company_id
                    )
                )
              )
          )
        )
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
