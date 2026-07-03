-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 69: User Type Permissions
-- Sistema configurable de permisos por tipo de usuario
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de permisos por tipo de usuario
CREATE TABLE IF NOT EXISTS user_type_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_type TEXT NOT NULL CHECK (user_type IN ('internal', 'adjuster', 'inspector', 'client_operator')),
  section TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_type, section)
);

-- 2. Secciones del sistema
-- dashboard, claims, inspecciones, agenda
-- catalogos, catalogos_inspeccion, operaciones, administracion
-- users, companies, configuracion

-- 3. Insertar permisos por defecto para INTERNAL (todo acceso)
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('internal', 'dashboard', true, false, false, false),
  ('internal', 'claims', true, true, true, true),
  ('internal', 'inspecciones', true, true, true, true),
  ('internal', 'agenda', true, true, true, false),
  ('internal', 'catalogos', true, true, true, true),
  ('internal', 'catalogos_inspeccion', true, true, true, true),
  ('internal', 'operaciones', true, true, true, false),
  ('internal', 'administracion', true, true, true, true),
  ('internal', 'users', true, true, true, false),
  ('internal', 'companies', true, true, true, false),
  ('internal', 'configuracion', true, true, false, false)
ON CONFLICT (user_type, section) DO NOTHING;

-- 4. INSERT para ADJUSTER (Liquidador)
-- Ve siniestros de sus clientes, puede intervenir en gestiones donde es liquidador
-- Ve inspecciones de sus clientes (solo vista)
-- No ve catálogos, operaciones, ni administración
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('adjuster', 'dashboard', true, false, false, false),
  ('adjuster', 'claims', true, true, false, false),
  ('adjuster', 'inspecciones', true, false, false, false),
  ('adjuster', 'agenda', true, false, false, false),
  ('adjuster', 'catalogos', false, false, false, false),
  ('adjuster', 'catalogos_inspeccion', false, false, false, false),
  ('adjuster', 'operaciones', false, false, false, false),
  ('adjuster', 'administracion', false, false, false, false),
  ('adjuster', 'users', false, false, false, false),
  ('adjuster', 'companies', false, false, false, false),
  ('adjuster', 'configuracion', false, false, false, false)
ON CONFLICT (user_type, section) DO NOTHING;

-- 5. INSERT para INSPECTOR
-- Ve siniestros donde es inspector, completa inspecciones donde está a cargo
-- No ve catálogos, operaciones, ni administración
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('inspector', 'dashboard', true, false, false, false),
  ('inspector', 'claims', true, false, false, false),
  ('inspector', 'inspecciones', true, true, true, false),
  ('inspector', 'agenda', true, false, false, false),
  ('inspector', 'catalogos', false, false, false, false),
  ('inspector', 'catalogos_inspeccion', false, false, false, false),
  ('inspector', 'operaciones', false, false, false, false),
  ('inspector', 'administracion', false, false, false, false),
  ('inspector', 'users', false, false, false, false),
  ('inspector', 'companies', false, false, false, false),
  ('inspector', 'configuracion', false, false, false, false)
ON CONFLICT (user_type, section) DO NOTHING;

-- 6. INSERT para CLIENT_OPERATOR (Operativo del cliente)
-- Ve siniestros de su empresa, agenda, descarga informes
-- Solo lectura, no puede crear ni editar
INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
  ('client_operator', 'dashboard', true, false, false, false),
  ('client_operator', 'claims', true, false, false, false),
  ('client_operator', 'inspecciones', true, false, false, false),
  ('client_operator', 'agenda', true, false, false, false),
  ('client_operator', 'catalogos', false, false, false, false),
  ('client_operator', 'catalogos_inspeccion', false, false, false, false),
  ('client_operator', 'operaciones', false, false, false, false),
  ('client_operator', 'administracion', false, false, false, false),
  ('client_operator', 'users', false, false, false, false),
  ('client_operator', 'companies', false, false, false, false),
  ('client_operator', 'configuracion', false, false, false, false)
ON CONFLICT (user_type, section) DO NOTHING;

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_user_type_permissions_type ON user_type_permissions(user_type);

COMMENT ON TABLE user_type_permissions IS 'Permisos configurables por tipo de usuario. Define qué secciones puede ver, editar, crear y eliminar cada tipo.';
