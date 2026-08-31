-- ═══════════════════════════════════════════════════════════════════
-- Migración 353: PIN offline en profiles
-- ═══════════════════════════════════════════════════════════════════
-- El inspector elige un PIN de 4-6 dígitos para acceder a inspecciones
-- descargadas sin conexión. Se guarda hasheado (bcrypt) en Supabase.
-- Al descargar una inspección, el hash se sincroniza a IndexedDB.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS offline_pin_hash text;

COMMENT ON COLUMN profiles.offline_pin_hash IS
  'Hash bcrypt del PIN para login offline (inspecciones descargadas sin conexión)';
