-- ═══════════════════════════════════════════════════════════════
-- Migration 319: Permisos para secciones faltantes del menú
--
-- Agrega filas en user_type_permissions para las secciones que aparecen
-- en el menú pero no tenían permiso propio:
--   - supervision
--   - informes
--
-- Por defecto solo "internal" puede verlas; el admin las habilita para
-- otros perfiles desde /dashboard/permisos.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  r user_role;
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['supervision', 'informes'] LOOP
    FOR r IN SELECT unnest(enum_range(NULL::user_role)) LOOP
      INSERT INTO user_type_permissions (
        id,
        user_type,
        section,
        can_view,
        can_edit,
        can_create,
        can_delete,
        created_at,
        updated_at
      )
      SELECT
        gen_random_uuid(),
        r,
        s,
        (r::text = 'internal'),
        false,
        false,
        false,
        now(),
        now()
      WHERE NOT EXISTS (
        SELECT 1 FROM user_type_permissions
        WHERE user_type = r::text AND section = s
      );
    END LOOP;
  END LOOP;
END $$;
