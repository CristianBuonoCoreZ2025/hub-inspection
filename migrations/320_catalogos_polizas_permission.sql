-- ═══════════════════════════════════════════════════════════════
-- Migration 320: Permiso para la sub-página Pólizas
--
-- Agrega filas en user_type_permissions para la sección catalogos_polizas.
-- Solo "internal" tiene todos los permisos por defecto.
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
      'catalogos_polizas',
      (r::text = 'internal'),
      (r::text = 'internal'),
      (r::text = 'internal'),
      (r::text = 'internal'),
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM user_type_permissions
      WHERE user_type = r::text AND section = 'catalogos_polizas'
    );
  END LOOP;
END $$;
