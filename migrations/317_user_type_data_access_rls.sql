-- ═══════════════════════════════════════════════════════════════
-- Migration 317: RLS y grants para user_type_data_access
--
-- Habilita RLS en user_type_data_access y permite:
--   - SELECT a cualquier usuario autenticado.
--   - UPDATE solo a usuarios cuyo perfil tenga is_admin = true.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

-- RLS activo
ALTER TABLE user_type_data_access ENABLE ROW LEVEL SECURITY;

-- Política de lectura para todos los autenticados
DROP POLICY IF EXISTS "user_type_data_access_select" ON user_type_data_access;
CREATE POLICY "user_type_data_access_select" ON user_type_data_access
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de actualización solo para administradores
DROP POLICY IF EXISTS "user_type_data_access_update" ON user_type_data_access;
CREATE POLICY "user_type_data_access_update" ON user_type_data_access
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN user_type_data_access da ON da.user_type = p.role
      WHERE p.user_id = auth.uid()
        AND da.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN user_type_data_access da ON da.user_type = p.role
      WHERE p.user_id = auth.uid()
        AND da.is_admin = true
    )
  );
