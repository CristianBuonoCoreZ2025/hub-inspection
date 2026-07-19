-- Migration 171: Agregar permiso "informes" para todos los user_types
-- El modulo de Informes (reportes) no tenia permiso en user_type_permissions,
-- por lo que canView("informes") retornaba false y el link se ocultaba del menu.

INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
SELECT ut, 'informes', true, true, true, false
FROM (VALUES
  ('internal'),
  ('adjuster'),
  ('inspector'),
  ('assistant'),
  ('auditor'),
  ('dispatcher')
) AS t(ut)
WHERE NOT EXISTS (
  SELECT 1 FROM user_type_permissions p
  WHERE p.user_type = t.ut AND p.section = 'informes'
);
