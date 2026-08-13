-- 341_mobile_inspection_columns.sql
-- Columnas aditivas para soporte mobile del módulo de inspecciones.
-- No destructivo: todas las columnas tienen defaults seguros.

-- Permite habilitar/deshabilitar el acceso mobile por usuario.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile_enabled BOOLEAN NOT NULL DEFAULT false;

-- Marca si una sesión de inspección fue iniciada desde un dispositivo mobile.
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS started_from_mobile BOOLEAN NOT NULL DEFAULT false;

-- Comentario para documentación.
COMMENT ON COLUMN profiles.mobile_enabled IS 'Habilita el acceso al módulo de inspección mobile para este usuario.';
COMMENT ON COLUMN inspection_sessions.started_from_mobile IS 'Indica si la inspección fue iniciada desde un dispositivo móvil/tablet.';
