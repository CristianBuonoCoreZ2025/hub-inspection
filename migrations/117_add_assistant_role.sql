-- ═══════════════════════════════════════════════════════════════
-- 117: Agregar rol 'assistant' al sistema
--
-- El asistente es un perfil que ayuda al liquidador con gestiones.
-- Es un rol interno que puede tener gestiones asignadas.
-- ═══════════════════════════════════════════════════════════════

-- 1. Actualizar CHECK constraint de profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('internal', 'adjuster', 'inspector', 'assistant', 'client_operator'));

-- 2. Actualizar CHECK constraint de user_type_permissions.user_type
ALTER TABLE user_type_permissions DROP CONSTRAINT IF EXISTS user_type_permissions_user_type_check;
ALTER TABLE user_type_permissions ADD CONSTRAINT user_type_permissions_user_type_check
  CHECK (user_type IN ('internal', 'adjuster', 'inspector', 'assistant', 'client_operator'));

-- 3. Insertar permisos base para el rol 'assistant' (hereda de adjuster)
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
SELECT 'assistant', section, can_view, can_edit, can_create, can_delete
FROM user_type_permissions
WHERE user_type = 'adjuster'
ON CONFLICT DO NOTHING;
