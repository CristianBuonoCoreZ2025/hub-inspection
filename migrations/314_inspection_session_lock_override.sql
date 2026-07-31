-- ═══════════════════════════════════════════════════════════════
-- Migration 314: Bloqueo de inspecciones activas en curso
--
-- Cuando una inspección pasa a status='active' solo el inspector asignado
-- puede acceder para evitar que múltiples personas intervengan.
-- Los usuarios internal pueden "levantar" ese bloqueo desde Supervisión,
-- registrando quién lo hizo y cuándo. Una vez levantado, un administrador
-- puede entrar para cerrar/finalizar la inspección.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

-- Columnas para controlar el levantamiento del bloqueo
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS lock_overridden_by uuid,
  ADD COLUMN IF NOT EXISTS lock_overridden_at timestamp with time zone;

-- Foreign key al perfil que levantó el bloqueo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inspection_sessions_lock_overridden_by_fkey'
  ) THEN
    ALTER TABLE inspection_sessions
      ADD CONSTRAINT inspection_sessions_lock_overridden_by_fkey
      FOREIGN KEY (lock_overridden_by) REFERENCES profiles(id);
  END IF;
END $$;
