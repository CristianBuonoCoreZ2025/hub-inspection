-- ============================================================
-- Hub Inspections — Migración: Extender inspection_sessions
-- y agregar campos faltantes en claims (contacto + hora siniestro)
-- ============================================================

-- ── 1. CAMPOS FALTANTES EN CLAIMS ──
-- Hora del siniestro, datos del contacto (diferente del asegurado)
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS claim_time TIME,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_role TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN claims.claim_time IS 'Hora del siniestro (ej: 22:00)';
COMMENT ON COLUMN claims.contact_name IS 'Nombre del contacto (entrevistado principal)';
COMMENT ON COLUMN claims.contact_role IS 'Cargo/relación del contacto (ej: arrendatario)';
COMMENT ON COLUMN claims.contact_email IS 'Correo electrónico del contacto';

-- ── 2. CAMPOS EN INSPECTION_SESSIONS ──
-- Datos capturados en terreno para el Acta de Inspección
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS inspection_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_time TIME,
  ADD COLUMN IF NOT EXISTS interviewed_name TEXT,
  ADD COLUMN IF NOT EXISTS interviewed_email TEXT,
  ADD COLUMN IF NOT EXISTS interviewed_relationship TEXT,
  ADD COLUMN IF NOT EXISTS police_report_number TEXT,
  ADD COLUMN IF NOT EXISTS police_report_name TEXT,
  ADD COLUMN IF NOT EXISTS police_report_rut TEXT,
  ADD COLUMN IF NOT EXISTS firefighters_company TEXT,
  ADD COLUMN IF NOT EXISTS other_insurances BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS other_insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS inspector_observations TEXT;

COMMENT ON COLUMN inspection_sessions.inspection_date IS 'Fecha en que se realizó la inspección en terreno';
COMMENT ON COLUMN inspection_sessions.inspection_time IS 'Hora de la inspección en terreno';
COMMENT ON COLUMN inspection_sessions.interviewed_name IS 'Nombre de la persona entrevistada en terreno';
COMMENT ON COLUMN inspection_sessions.interviewed_email IS 'Correo del entrevistado';
COMMENT ON COLUMN inspection_sessions.interviewed_relationship IS 'Relación con el asegurado (ej: arrendatario, propietario)';
COMMENT ON COLUMN inspection_sessions.police_report_number IS 'Número de parte policial';
COMMENT ON COLUMN inspection_sessions.police_report_name IS 'Nombre del denunciante en parte policial';
COMMENT ON COLUMN inspection_sessions.police_report_rut IS 'RUT del denunciante en parte policial';
COMMENT ON COLUMN inspection_sessions.firefighters_company IS 'Nombre de la compañía de bomberos que concurrió';
COMMENT ON COLUMN inspection_sessions.other_insurances IS '¿El asegurado tiene otros seguros?';
COMMENT ON COLUMN inspection_sessions.other_insurance_company IS 'Nombre de la compañía de otros seguros';
COMMENT ON COLUMN inspection_sessions.inspector_observations IS 'Observaciones finales del inspector';

-- ── 3. TRIGGER updated_at para inspection_sessions (ya existe desde 01_tables.sql) ──
-- No se necesita modificar.
