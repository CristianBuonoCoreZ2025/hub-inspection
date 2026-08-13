-- Migración 280: Columnas e índice faltantes en producción
-- Agrega columnas que existen en local pero no en producción

-- 1. inspection_sessions.started_from_mobile (boolean, default false)
ALTER TABLE public.inspection_sessions
  ADD COLUMN IF NOT EXISTS started_from_mobile boolean NOT NULL DEFAULT false;

-- 2. profiles.mobile_enabled (boolean, default false)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mobile_enabled boolean NOT NULL DEFAULT false;

-- 3. Índice idx_subcoverage_catalog_parent_active en subcoverage_catalog
CREATE INDEX IF NOT EXISTS idx_subcoverage_catalog_parent_active
  ON public.subcoverage_catalog (coverage_catalog_id, is_active);
