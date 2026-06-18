-- ============================================================
-- Hub Inspections — Migracion 11: Campos del Acta de Inspeccion
-- ============================================================

-- Agregar columnas JSONB para almacenar los 5 formularios del Acta
-- dentro de inspection_sessions (un Acta pertenece a una sesion)

ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS property_risk JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS property_materiality JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS security_measures JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insured_statement JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS third_parties JSONB DEFAULT '[]';

COMMENT ON COLUMN inspection_sessions.property_risk IS 'Paso 2 Acta: Descripcion del Riesgo Siniestrado';
COMMENT ON COLUMN inspection_sessions.property_materiality IS 'Paso 3 Acta: Materialidad del Inmueble';
COMMENT ON COLUMN inspection_sessions.security_measures IS 'Paso 4 Acta: Medidas de Asegurabilidad';
COMMENT ON COLUMN inspection_sessions.insured_statement IS 'Paso 5 Acta: Declaracion del Asegurado';
COMMENT ON COLUMN inspection_sessions.third_parties IS 'Paso 6 Acta: Datos de Terceros (array JSONB)';
