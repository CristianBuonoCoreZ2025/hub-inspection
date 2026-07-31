-- ═══════════════════════════════════════════════════════════════
-- Migration 316: Permiso propio para la página Perfiles
--
-- Crea filas en user_type_permissions para la sección "perfiles".
-- Solo "internal" tiene view/edit por defecto; el administrador puede
-- habilitarlo para otros perfiles desde /dashboard/permisos.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  r user_role;
BEGIN
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
      'perfiles',
      (r::text = 'internal'),
      (r::text = 'internal'),
      false,
      false,
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM user_type_permissions
      WHERE user_type = r::text AND section = 'perfiles'
    );
  END LOOP;
END $$;
