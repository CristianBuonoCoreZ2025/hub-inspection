-- Migración 327: permitir seleccionar qué evidencias fotográficas van al informe PDF

ALTER TABLE inspection_evidences
ADD COLUMN IF NOT EXISTS include_in_report BOOLEAN NOT NULL DEFAULT true;

-- Índice para consultas por sesión + incluidas
CREATE INDEX IF NOT EXISTS idx_inspection_evidences_include
ON inspection_evidences(session_id, include_in_report)
WHERE type = 'photo';
