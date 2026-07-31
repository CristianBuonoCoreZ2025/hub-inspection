-- ═════════════════════════════════════════════════════════════════
-- Migration 327: Correcciones detectadas en métricas de consultas
--
-- Errores reportados:
--   1. Columna ai_analyzed_at inexistente en claim_images, claim_documents,
--      inspection_evidences.
--   2. Columna lock_overridden_by inexistente en inspection_sessions.
--   3. inspection_damages.quantity recibe decimales pero es INTEGER.
--
-- No borra datos. Ajusta tipos y agrega columnas con IF NOT EXISTS.
-- ═════════════════════════════════════════════════════════════════

-- 1. AI: columna ai_analyzed_at en tablas con análisis de IA
ALTER TABLE claim_images
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

ALTER TABLE claim_documents
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

-- 2. Lock override en inspection_sessions
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS lock_overridden_by UUID,
  ADD COLUMN IF NOT EXISTS lock_overridden_at TIMESTAMPTZ;

-- Foreign key si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inspection_sessions_lock_overridden_by_fkey'
  ) THEN
    ALTER TABLE inspection_sessions
      ADD CONSTRAINT inspection_sessions_lock_overridden_by_fkey
      FOREIGN KEY (lock_overridden_by) REFERENCES profiles(id);
  END IF;
END $$;

-- 3. quantity de inspection_damages de INTEGER a NUMERIC(25,6)
--    para soportar M2/M3 y cantidades decimales sin perder datos.
ALTER TABLE inspection_damages
  ALTER COLUMN quantity TYPE NUMERIC(25,6)
  USING quantity::numeric;

INSERT INTO _migrations (filename) VALUES ('327_fix_metrics_errors.sql')
ON CONFLICT (filename) DO NOTHING;
