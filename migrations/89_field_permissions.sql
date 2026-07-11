-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 89: Field-Level Permissions
-- Permite configurar qué campos puede editar cada rol por entidad.
-- Se integra con el sistema existente de user_type_permissions.
--
-- Lógica:
--   1. user_type_permissions controla acceso a SECCIONES (view/edit/create/delete)
--   2. field_permissions controla acceso a CAMPOS individuales dentro de una sección
--
-- Regla de default: si NO existe fila para (user_type, section, field_name),
-- el campo es editable (can_edit = true por defecto).
-- Solo se insertan filas para RESTRINGIR campos.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS field_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_type TEXT NOT NULL CHECK (user_type IN ('internal', 'adjuster', 'inspector', 'client_operator')),
  section TEXT NOT NULL,
  field_name TEXT NOT NULL,
  can_edit BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_type, section, field_name)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_field_permissions_type_section ON field_permissions(user_type, section);
CREATE INDEX IF NOT EXISTS idx_field_permissions_section ON field_permissions(section);

-- Comentario
COMMENT ON TABLE field_permissions IS 'Permisos a nivel de campo por tipo de usuario. Controla qué campos puede editar cada rol dentro de una sección. Si no hay fila para un campo, default = editable.';

-- ═══════════════════════════════════════════════════════════════
-- Seed inicial: restringir campos sensibles para roles no-internal
-- ═══════════════════════════════════════════════════════════════

-- Gestiones (catalogos_gestiones): adjuster puede editar datos operativos
-- pero NO campos estructurales (is_blocker, review_levels, roles)
INSERT INTO field_permissions (user_type, section, field_name, can_edit) VALUES
  -- Liquidador: puede editar nombres, días, descripciones; NO estructura
  ('adjuster', 'catalogos_gestiones', 'is_blocker', false),
  ('adjuster', 'catalogos_gestiones', 'review_levels', false),
  ('adjuster', 'catalogos_gestiones', 'is_dispatch_applicable', false),
  ('adjuster', 'catalogos_gestiones', 'issuer_roles', false),
  ('adjuster', 'catalogos_gestiones', 'reviewer_roles', false),
  ('adjuster', 'catalogos_gestiones', 'approver_roles', false),
  ('adjuster', 'catalogos_gestiones', 'is_active', false),
  -- Inspector: mismo que adjuster
  ('inspector', 'catalogos_gestiones', 'is_blocker', false),
  ('inspector', 'catalogos_gestiones', 'review_levels', false),
  ('inspector', 'catalogos_gestiones', 'is_dispatch_applicable', false),
  ('inspector', 'catalogos_gestiones', 'issuer_roles', false),
  ('inspector', 'catalogos_gestiones', 'reviewer_roles', false),
  ('inspector', 'catalogos_gestiones', 'approver_roles', false),
  ('inspector', 'catalogos_gestiones', 'is_active', false),
  -- Operativo: mismo que adjuster
  ('client_operator', 'catalogos_gestiones', 'is_blocker', false),
  ('client_operator', 'catalogos_gestiones', 'review_levels', false),
  ('client_operator', 'catalogos_gestiones', 'is_dispatch_applicable', false),
  ('client_operator', 'catalogos_gestiones', 'issuer_roles', false),
  ('client_operator', 'catalogos_gestiones', 'reviewer_roles', false),
  ('client_operator', 'catalogos_gestiones', 'approver_roles', false),
  ('client_operator', 'catalogos_gestiones', 'is_active', false)
ON CONFLICT (user_type, section, field_name) DO NOTHING;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_field_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_field_permissions_updated_at ON field_permissions;
CREATE TRIGGER trg_field_permissions_updated_at
  BEFORE UPDATE ON field_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_field_permissions_updated_at();
