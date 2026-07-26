-- Migración 256: Agrega correlativo y parent_action_code a email_logs
-- Permite que cada e-mail enviado tenga un código legible tipo:
--   L-000000141-COI-005-EML-001
-- donde:
--   - L-000000141-COI-005 = código de la gestión padre (claim_action)
--   - EML-001 = correlativo secuencial por gestión padre
--
-- El correlativo se genera automáticamente vía trigger atómico (sin race conditions).

-- ═══ 1. Columnas nuevas ═══
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS correlativo INT;

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS parent_action_code TEXT;

-- Comentario para documentación
COMMENT ON COLUMN email_logs.correlativo IS
  'Correlativo secuencial por claim_action_id (1, 2, 3...). Se asigna automáticamente al insertar.';
COMMENT ON COLUMN email_logs.parent_action_code IS
  'Código de la gestión padre (claim_action.code) al momento del envío. Se denormaliza para mostrar en grilla sin JOIN.';

-- Backfill: asignar correlativo a logs existentes (ordenados por created_at)
WITH ranked AS (
  SELECT id, claim_action_id,
    ROW_NUMBER() OVER (PARTITION BY claim_action_id ORDER BY created_at) AS rn
  FROM email_logs
  WHERE correlativo IS NULL
)
UPDATE email_logs el
  SET correlativo = ranked.rn
  FROM ranked
  WHERE el.id = ranked.id;

-- Hacer NOT NULL después del backfill
ALTER TABLE email_logs
  ALTER COLUMN correlativo SET NOT NULL;

-- Índice para buscar logs por gestión + correlativo
CREATE INDEX IF NOT EXISTS idx_email_logs_action_correlativo
  ON email_logs(claim_action_id, correlativo);

-- ═══ 2. Función atómica para next correlativo ═══
-- Llamada por el trigger BEFORE INSERT. Garantiza numeración secuencial
-- sin gaps ni duplicados incluso con inserts concurrentes.
CREATE OR REPLACE FUNCTION next_email_correlativo()
RETURNS TRIGGER AS $$
DECLARE
  next_val INT;
BEGIN
  SELECT COALESCE(MAX(correlativo), 0) + 1
    INTO next_val
    FROM email_logs
    WHERE claim_action_id = NEW.claim_action_id
    FOR UPDATE;  -- lock de fila para evitar race condition
  NEW.correlativo := next_val;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══ 3. Trigger BEFORE INSERT ═══
DROP TRIGGER IF EXISTS trg_email_logs_correlativo ON email_logs;
CREATE TRIGGER trg_email_logs_correlativo
  BEFORE INSERT ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION next_email_correlativo();

-- ═══ 4. Función helper para construir el código completo ═══
-- Devuelve el código legible: {parent_action_code}-EML-{correlativo:03d}
-- Ej: "L-000000141-COI-005-EML-001"
CREATE OR REPLACE FUNCTION email_log_full_code(p_log_id UUID)
RETURNS TEXT AS $$
DECLARE
  log_row RECORD;
BEGIN
  SELECT el.correlativo, el.parent_action_code, ca.code AS action_code
    INTO log_row
    FROM email_logs el
    LEFT JOIN claim_actions ca ON ca.id = el.claim_action_id
    WHERE el.id = p_log_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN COALESCE(log_row.parent_action_code, log_row.action_code, '—')
    || '-EML-' || lpad(log_row.correlativo::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;
