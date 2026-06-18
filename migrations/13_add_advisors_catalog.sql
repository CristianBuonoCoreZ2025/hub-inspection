-- ============================================================
-- Hub Inspections — Migracion 13: Catalogo de Asesores
-- ============================================================

CREATE TABLE IF NOT EXISTS advisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT NOT NULL DEFAULT 'CL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE advisors IS 'Catalogo de asesores de seguros';

DROP TRIGGER IF EXISTS advisors_updated_at ON advisors;
CREATE TRIGGER advisors_updated_at BEFORE UPDATE ON advisors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
