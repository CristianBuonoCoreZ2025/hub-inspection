-- Migration 337: Modelo de reloj de ajedrez con substate + work_periods
--
-- Cambios:
-- 1. Drop inspection_pauses (creada en 335, sin datos reales).
-- 2. Crear inspection_work_periods: intervalos activos de cada inspección.
-- 3. Agregar substate a inspection_sessions: normal | paused.
-- 4. Revertir CHECK de status (sin 'paused', vuelve a scheduled|active|completed|cancelled).
-- 5. Backfill de work_periods para inspecciones completadas históricas.
--
-- Modelo:
--   status: scheduled | active | completed | cancelled
--   substate: normal | paused (default: normal)
--
-- Flujo:
--   Inicia: status→active, substate→normal, work_period (started_at=now, ended_at=NULL)
--   Pausa:  status→scheduled, substate→paused, work_period cierra (ended_at=now)
--   Reanuda: status→active, substate→normal, nuevo work_period (started_at=now, ended_at=NULL)
--   Completa: status→completed, work_period cierra (ended_at=now)
--
-- Tiempo activo = sum(ended_at - started_at) de work_periods.

-- 1. Drop inspection_pauses (sin datos reales, creada en 335)
DROP TABLE IF EXISTS inspection_pauses CASCADE;

-- 2. Crear inspection_work_periods
CREATE TABLE IF NOT EXISTS inspection_work_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_work_periods_session_id
  ON inspection_work_periods(inspection_session_id);

CREATE INDEX IF NOT EXISTS idx_inspection_work_periods_company_id
  ON inspection_work_periods(company_id);

-- Índice para encontrar el periodo abierto (ended_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_inspection_work_periods_open
  ON inspection_work_periods(inspection_session_id)
  WHERE ended_at IS NULL;

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_inspection_work_periods_updated_at ON inspection_work_periods;
CREATE TRIGGER set_inspection_work_periods_updated_at
  BEFORE UPDATE ON inspection_work_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE inspection_work_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_work_periods FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_work_periods_select_company" ON inspection_work_periods;
DROP POLICY IF EXISTS "inspection_work_periods_all_company" ON inspection_work_periods;

CREATE POLICY "inspection_work_periods_select_company" ON inspection_work_periods
  FOR SELECT
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_company_id', true) IS NULL
    OR current_setting('app.current_company_id', true) = ''
  );

CREATE POLICY "inspection_work_periods_all_company" ON inspection_work_periods
  FOR ALL
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_company_id', true) IS NULL
    OR current_setting('app.current_company_id', true) = ''
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_work_periods TO authenticated, anon;

-- 3. Agregar substate a inspection_sessions
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS substate TEXT NOT NULL DEFAULT 'normal';

-- 4. Revertir CHECK de status (sin 'paused')
ALTER TABLE inspection_sessions DROP CONSTRAINT IF EXISTS inspection_sessions_status_check;
ALTER TABLE inspection_sessions ADD CONSTRAINT inspection_sessions_status_check
  CHECK (status IN ('pending','scheduled','active','completed','cancelled'));

-- 5. Backfill de work_periods para inspecciones con started_at (históricas)
INSERT INTO inspection_work_periods (inspection_session_id, company_id, started_at, ended_at)
  SELECT id, company_id, started_at, ended_at
  FROM inspection_sessions
  WHERE started_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM inspection_work_periods iwp
      WHERE iwp.inspection_session_id = inspection_sessions.id
    );
