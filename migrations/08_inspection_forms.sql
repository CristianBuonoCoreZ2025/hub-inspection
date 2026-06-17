-- ============================================================
-- Hub Inspections — Migración: Tablas de inspección en terreno
-- 6 tablas nuevas para el Acta de Inspección McLarens
-- ============================================================

-- ── 1. PROPERTY_RISK — Descripción del Riesgo Siniestrado ──
CREATE TABLE IF NOT EXISTS property_risk (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  risk_type TEXT,
  risk_class TEXT,
  property_type TEXT,               -- casa, departamento, bodega, oficina
  apartment_number TEXT,
  floor_count INTEGER,
  age_years INTEGER,
  built_surface INTEGER,
  room_count INTEGER,
  bathroom_count INTEGER,
  office_count INTEGER,
  warehouse_count INTEGER,
  is_habitable BOOLEAN,
  owner_name TEXT,
  branch_count INTEGER,
  worker_resident_count INTEGER,
  business_line TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE property_risk IS 'Descripción del riesgo siniestrado (tipo de inmueble, antigüedad, espacios, etc.)';

-- ── 2. PROPERTY_MATERIALITY — Materialidad del Inmueble ──
CREATE TABLE IF NOT EXISTS property_materiality (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  walls TEXT,
  roof TEXT,
  interior_flooring TEXT,
  interior_ceilings TEXT,
  interior_finishes TEXT,
  exterior_finishes TEXT,
  perimeter_closure TEXT,
  others TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE property_materiality IS 'Materialidad del inmueble inspeccionado';

-- ── 3. SECURITY_MEASURES — Medidas de Asegurabilidad ──
CREATE TABLE IF NOT EXISTS security_measures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  protections BOOLEAN DEFAULT false,
  protections_detail TEXT,
  security_locks BOOLEAN DEFAULT false,
  security_locks_detail TEXT,
  security_guards BOOLEAN DEFAULT false,
  security_guards_detail TEXT,
  alarms BOOLEAN DEFAULT false,
  alarms_detail TEXT,
  cameras BOOLEAN DEFAULT false,
  cameras_detail TEXT,
  other_measures TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE security_measures IS 'Medidas de asegurabilidad del inmueble (protecciones, alarmas, cámaras, etc.)';

-- ── 4. INSURED_STATEMENT — Declaración del Asegurado ──
CREATE TABLE IF NOT EXISTS insured_statement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  statement TEXT,
  entry_exit_point TEXT,
  alarm_activation TEXT,
  stolen_items_estimate TEXT,
  vehicle_use TEXT,
  incident_duration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE insured_statement IS 'Declaración del asegurado / relato de los hechos';

-- ── 5. THIRD_PARTIES — Datos de Terceros ──
CREATE TABLE IF NOT EXISTS third_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  party_type TEXT NOT NULL CHECK (party_type IN ('affected','responsible')),
  full_name TEXT,
  rut TEXT,
  address TEXT,
  commune TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE third_parties IS 'Terceros afectados y responsables';

-- ── 6. DAMAGE_SKETCHES — Croquis de Áreas Afectadas ──
CREATE TABLE IF NOT EXISTS damage_sketches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  sketch_url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE damage_sketches IS 'Croquis / planos de áreas afectadas subidos por el inspector';

-- ── TRIGGERS updated_at ──
DROP TRIGGER IF EXISTS property_risk_updated_at ON property_risk;
CREATE TRIGGER property_risk_updated_at BEFORE UPDATE ON property_risk
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS property_materiality_updated_at ON property_materiality;
CREATE TRIGGER property_materiality_updated_at BEFORE UPDATE ON property_materiality
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS security_measures_updated_at ON security_measures;
CREATE TRIGGER security_measures_updated_at BEFORE UPDATE ON security_measures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS insured_statement_updated_at ON insured_statement;
CREATE TRIGGER insured_statement_updated_at BEFORE UPDATE ON insured_statement
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS third_parties_updated_at ON third_parties;
CREATE TRIGGER third_parties_updated_at BEFORE UPDATE ON third_parties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
