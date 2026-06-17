-- ============================================================
-- Hub Inspections — Migración: Extender tabla claims
-- Agrega ~25 columnas para datos del sistema McLarens
-- ============================================================

-- ── 1. CAMPOS DEL ASEGURADO ──
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS rut TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Chile',
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS commune TEXT,
  ADD COLUMN IF NOT EXISTS cell_phone TEXT;

-- ── 2. CAMPOS DEL SINIESTRO / LIQUIDACIÓN ──
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS assignment_date DATE,
  ADD COLUMN IF NOT EXISTS internal_number TEXT,
  ADD COLUMN IF NOT EXISTS company_report_number TEXT,
  ADD COLUMN IF NOT EXISTS mclarens_one_number TEXT,
  ADD COLUMN IF NOT EXISTS liquidation_number TEXT,
  ADD COLUMN IF NOT EXISTS is_special_claim BOOLEAN DEFAULT false;

-- ── 3. EQUIPO ASIGNADO (FK → profiles) ──
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS inspector_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjuster_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatcher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assistant_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 4. CORREDOR / CONSTRUCTORA ──
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS broker_name TEXT,
  ADD COLUMN IF NOT EXISTS broker_executive TEXT,
  ADD COLUMN IF NOT EXISTS broker_number TEXT,
  ADD COLUMN IF NOT EXISTS builder_name TEXT,
  ADD COLUMN IF NOT EXISTS advisor TEXT;

-- ── 5. RECUPERO / CAUSAL ──
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS claim_cause TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS recovery_type_legal TEXT,
  ADD COLUMN IF NOT EXISTS recovery_type_material TEXT,
  ADD COLUMN IF NOT EXISTS recovery_comments TEXT;

-- ── 6. TRIGGER updated_at para claims (ya existe, verificar) ──
-- El trigger claims_updated_at ya fue creado en 01_tables.sql
-- y se mantiene válido porque no renombramos la tabla.

-- ── 7. COMENTARIOS ──
COMMENT ON COLUMN claims.rut IS 'RUT del asegurado (Chile)';
COMMENT ON COLUMN claims.last_name IS 'Apellido del asegurado';
COMMENT ON COLUMN claims.country IS 'País del siniestro';
COMMENT ON COLUMN claims.region IS 'Región del siniestro';
COMMENT ON COLUMN claims.commune IS 'Comuna del siniestro';
COMMENT ON COLUMN claims.cell_phone IS 'Celular del asegurado';
COMMENT ON COLUMN claims.report_date IS 'Fecha de denuncio del siniestro';
COMMENT ON COLUMN claims.assignment_date IS 'Fecha de asignación del caso';
COMMENT ON COLUMN claims.internal_number IS 'Número interno de McLarens';
COMMENT ON COLUMN claims.company_report_number IS 'Número de denuncio en compañía';
COMMENT ON COLUMN claims.mclarens_one_number IS 'Número McLarens One';
COMMENT ON COLUMN claims.liquidation_number IS 'Número de liquidación (distinto del siniestro)';
COMMENT ON COLUMN claims.is_special_claim IS 'Indica si es siniestro especial';
COMMENT ON COLUMN claims.inspector_id IS 'Inspector asignado (FK → profiles)';
COMMENT ON COLUMN claims.adjuster_id IS 'Ajustador asignado (FK → profiles)';
COMMENT ON COLUMN claims.auditor_id IS 'Auditor asignado (FK → profiles)';
COMMENT ON COLUMN claims.dispatcher_id IS 'Despachador asignado (FK → profiles)';
COMMENT ON COLUMN claims.assistant_id IS 'Asistente asignado (FK → profiles)';
COMMENT ON COLUMN claims.broker_name IS 'Nombre del corredor';
COMMENT ON COLUMN claims.broker_executive IS 'Ejecutivo del corredor';
COMMENT ON COLUMN claims.broker_number IS 'Número del corredor';
COMMENT ON COLUMN claims.builder_name IS 'Constructora No. 1';
COMMENT ON COLUMN claims.advisor IS 'Asesor';
COMMENT ON COLUMN claims.claim_cause IS 'Causal específica del siniestro';
COMMENT ON COLUMN claims.summary IS 'Resumen / descripción del siniestro';
COMMENT ON COLUMN claims.recovery_type_legal IS 'Tipo de recupero legal';
COMMENT ON COLUMN claims.recovery_type_material IS 'Tipo de recupero material';
COMMENT ON COLUMN claims.recovery_comments IS 'Comentarios de recupero';
