-- ═══════════════════════════════════════════════════════════════
-- Migration 152: Eliminar perfil "client_operator" — unificar con "assistant"
-- ═══════════════════════════════════════════════════════════════
-- El perfil "client_operator" (Operativo) era duplicado de "assistant"
-- (Asistente). Se unifican: todos los client_operator pasan a assistant.
-- También se agregan los roles nuevos (auditor, dispatcher) al enum.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar valores faltantes al enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assistant';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dispatcher';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client_operator';

-- 2. Migrar usuarios existentes de client_operator → assistant
UPDATE profiles
SET role = 'assistant',
    updated_at = now()
WHERE role::TEXT = 'client_operator';

-- 3. Migrar permisos de client_operator → assistant (si existen)
UPDATE user_type_permissions
SET user_type = 'assistant'
WHERE user_type::TEXT = 'client_operator';

-- 4. Eliminar duplicados que puedan surgir del merge (mismo user_type + section + field_name)
DELETE FROM user_type_permissions
WHERE id NOT IN (
  SELECT MIN(id) FROM user_type_permissions
  GROUP BY user_type, section, field_name
);

-- 5. Actualizar CHECK constraint de profiles.role (sin client_operator)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'));

-- 6. Actualizar CHECK constraint de user_type_permissions.user_type (sin client_operator)
ALTER TABLE user_type_permissions DROP CONSTRAINT IF EXISTS user_type_permissions_user_type_check;
ALTER TABLE user_type_permissions ADD CONSTRAINT user_type_permissions_user_type_check
  CHECK (user_type IN ('internal', 'adjuster', 'inspector', 'assistant', 'auditor', 'dispatcher'));

-- 7. Verificar
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM profiles WHERE role::TEXT = 'client_operator';
  IF remaining_count > 0 THEN
    RAISE NOTICE 'ADVERTENCIA: Quedan % usuarios con role=client_operator', remaining_count;
  ELSE
    RAISE NOTICE 'OK: No quedan usuarios con role=client_operator';
  END IF;
END $$;
