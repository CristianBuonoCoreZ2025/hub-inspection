-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 76: Permisos para Configuración de Gestiones
-- Agrega la sección 'gestiones' a user_type_permissions
-- ═══════════════════════════════════════════════════════════════

-- INTERNAL: acceso total a configuración de gestiones
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('internal', 'gestiones', true, true, true, true)
ON CONFLICT (user_type, section) DO NOTHING;

-- ADJUSTER: sin acceso a configuración (solo ejecuta gestiones en siniestros)
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('adjuster', 'gestiones', false, false, false, false)
ON CONFLICT (user_type, section) DO NOTHING;

-- INSPECTOR: sin acceso a configuración
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('inspector', 'gestiones', false, false, false, false)
ON CONFLICT (user_type, section) DO NOTHING;

-- CLIENT_OPERATOR: sin acceso a configuración
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('client_operator', 'gestiones', false, false, false, false)
ON CONFLICT (user_type, section) DO NOTHING;
