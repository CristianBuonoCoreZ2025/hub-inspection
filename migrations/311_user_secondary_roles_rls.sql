-- ═══════════════════════════════════════════════════════════════
-- Migration 311: Corregir RLS de user_secondary_roles
--
-- user_secondary_roles.company_id es la empresa cliente para la que se
-- otorga el rol secundario, NO la empresa del usuario que edita.
-- Por eso is_tenant_allowed(company_id) rechazaba inserciones legítimas.
--
-- Ahora se permite gestionar un rol secundario si el usuario que actúa
-- puede ver el perfil al que pertenece (is_profile_visible). Eso cubre:
-- - internal con o sin user_clients (fallback de is_profile_visible).
-- - usuarios que comparten compañía con el perfil objetivo.
--
-- El control de qué rol/cliente se puede asignar sigue en la app.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

-- Eliminamos las políticas tenant genéricas creadas por la migración 216
DROP POLICY IF EXISTS "user_secondary_roles_tenant_select" ON user_secondary_roles;
DROP POLICY IF EXISTS "user_secondary_roles_tenant_insert" ON user_secondary_roles;
DROP POLICY IF EXISTS "user_secondary_roles_tenant_update" ON user_secondary_roles;
DROP POLICY IF EXISTS "user_secondary_roles_tenant_delete" ON user_secondary_roles;
DROP POLICY IF EXISTS "user_secondary_roles_all" ON user_secondary_roles;

CREATE POLICY "user_secondary_roles_manage" ON user_secondary_roles
  FOR ALL
  TO authenticated
  USING (
    is_profile_visible(
      (SELECT user_id FROM profiles WHERE id = user_secondary_roles.profile_id)
    )
  )
  WITH CHECK (
    is_profile_visible(
      (SELECT user_id FROM profiles WHERE id = user_secondary_roles.profile_id)
    )
  );
