-- Migration 335: Tabla de pausas de inspección para calcular tiempo activo
-- Cada vez que se mueve la fecha de una inspección en progreso (active)
-- se registra el intervalo: paused_at = ahora, resumed_at = nueva fecha de retoma.
-- El tiempo efectivamente activo se calcula como:
--   (ended_at - started_at) - suma de pausas dentro de ese rango.

CREATE TABLE IF NOT EXISTS inspection_pauses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  paused_at TIMESTAMPTZ NOT NULL,
  resumed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_pauses_session_id
  ON inspection_pauses(inspection_session_id);

CREATE INDEX IF NOT EXISTS idx_inspection_pauses_company_id
  ON inspection_pauses(company_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_inspection_pauses_updated_at ON inspection_pauses;
CREATE TRIGGER set_inspection_pauses_updated_at
  BEFORE UPDATE ON inspection_pauses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE inspection_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_pauses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_pauses_select_company" ON inspection_pauses;
DROP POLICY IF EXISTS "inspection_pauses_all_company" ON inspection_pauses;

-- Política SELECT: tenant propio o sesión sin tenant configurado (migraciones/seed)
CREATE POLICY "inspection_pauses_select_company" ON inspection_pauses
  FOR SELECT
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_company_id', true) IS NULL
    OR current_setting('app.current_company_id', true) = ''
  );

-- Política INSERT/UPDATE/DELETE: tenant propio (fallback si no hay current_company_id)
CREATE POLICY "inspection_pauses_all_company" ON inspection_pauses
  FOR ALL
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_company_id', true) IS NULL
    OR current_setting('app.current_company_id', true) = ''
  );

-- Permisos para PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_pauses TO authenticated, anon;
