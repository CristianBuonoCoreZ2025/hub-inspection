-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 57: Flujo estricto de inspecciones
-- Reglas:
--   1. Un siniestro puede tener SOLO UNA inspección activa (pending/scheduled/active)
--   2. Al reagendar: se cancela la inspección actual y se crea una nueva
--   3. Al cancelar: se registra motivo de cancelación
--   4. Al finalizar o cancelar: se emite informe (de finalización o de cancelación)
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar campos de cancelación a inspection_sessions
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS cancellation_reason_id uuid,
  ADD COLUMN IF NOT EXISTS cancellation_notes text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- 2. Catálogo de motivos de cancelación
INSERT INTO lookup_catalog (category, code, name, sort_order, is_active)
VALUES
  ('cancellation_reason', 'no_answer', 'No se pudo contactar al asegurado', 1, true),
  ('cancellation_reason', 'insured_refused', 'Asegurado rechazó la inspección', 2, true),
  ('cancellation_reason', 'reschedule', 'Reagendado por solicitante', 3, true),
  ('cancellation_reason', 'weather', 'Condiciones climáticas adversas', 4, true),
  ('cancellation_reason', 'access_denied', 'Acceso al inmueble denegado', 5, true),
  ('cancellation_reason', 'duplicate', 'Inspección duplicada', 6, true),
  ('cancellation_reason', 'other', 'Otro motivo', 99, true)
ON CONFLICT DO NOTHING;

-- 3. FK de cancellation_reason_id hacia lookup_catalog
ALTER TABLE inspection_sessions
  DROP CONSTRAINT IF EXISTS inspection_sessions_cancellation_reason_id_fkey;
ALTER TABLE inspection_sessions
  ADD CONSTRAINT inspection_sessions_cancellation_reason_id_fkey
  FOREIGN KEY (cancellation_reason_id) REFERENCES lookup_catalog(id)
  ON DELETE SET NULL;

-- 4. Índice parcial para garantizar UNA inspección activa por siniestro
-- Los estados "activos" son: scheduled, active (no existe "pending")
-- Este índice UNIQUE parcial evita que se inserten dos inspecciones activas
DROP INDEX IF EXISTS inspection_sessions_one_active_per_claim;
CREATE UNIQUE INDEX inspection_sessions_one_active_per_claim
  ON inspection_sessions (claim_id)
  WHERE status IN ('scheduled', 'active');

-- 5. Agregar status 'cancelled' a inspection_reports
-- Ya existe status con values 'draft', 'generated', 'sent'
-- Agregamos 'cancellation' para distinguir informes de cancelación
ALTER TABLE inspection_reports
  DROP CONSTRAINT IF EXISTS inspection_reports_status_check;
ALTER TABLE inspection_reports
  ADD CONSTRAINT inspection_reports_status_check
  CHECK (status IN ('draft', 'generated', 'sent', 'cancellation'));

-- 6. Agregar campos al informe para distinguir tipo
ALTER TABLE inspection_reports
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'completion'
  CHECK (report_type IN ('completion', 'cancellation'));

-- 7. Agregar campos de cancelación al informe
ALTER TABLE inspection_reports
  ADD COLUMN IF NOT EXISTS cancellation_reason_id uuid,
  ADD COLUMN IF NOT EXISTS cancellation_notes text;

-- 8. Trigger: cuando una inspección se cancela, registrar cancelled_at automáticamente
CREATE OR REPLACE FUNCTION set_cancelled_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_cancelled_at ON inspection_sessions;
CREATE TRIGGER trg_set_cancelled_at
  BEFORE UPDATE ON inspection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_cancelled_at();

-- 9. Trigger: cuando una inspección se completa, registrar ended_at automáticamente
CREATE OR REPLACE FUNCTION set_ended_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.ended_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ended_at ON inspection_sessions;
CREATE TRIGGER trg_set_ended_at
  BEFORE UPDATE ON inspection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_ended_at();

-- 10. Trigger: cuando una inspección se inicia (active), registrar started_at
CREATE OR REPLACE FUNCTION set_started_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' AND NEW.started_at IS NULL THEN
    NEW.started_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_started_at ON inspection_sessions;
CREATE TRIGGER trg_set_started_at
  BEFORE UPDATE ON inspection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_started_at();
