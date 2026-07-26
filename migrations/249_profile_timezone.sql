-- Migration 249: Agregar timezone al perfil del usuario
--
-- Permite guardar la zona horaria del usuario como fallback cuando el
-- navegador no puede determinar la hora local.
-- ═════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Comentario para documentar el propósito
COMMENT ON COLUMN profiles.timezone IS 'Zona horaria IANA del usuario (ej. America/Santiago). Fallback si el navegador falla.';
