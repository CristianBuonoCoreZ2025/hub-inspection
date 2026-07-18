-- ═══════════════════════════════════════════════════════════════
-- Migration 164: Agregar tipo CRO (croquis) a claim_action_file_seq
-- ═══════════════════════════════════════════════════════════════
-- El croquis debe tener su propio código y correlativo independiente,
-- no compartir DOC con otros documentos.
--
-- Tipos de archivo por gestión:
--   EVI = evidencia (foto, video, pdf)
--   DOC = documento extra (oficio, respaldo)
--   CRO = croquis (dibujo de áreas afectadas)  ← NUEVO
--   FIR = firma
--   DAN = foto de daño
-- ═══════════════════════════════════════════════════════════════

-- 1. Relajar el CHECK para aceptar CRO
ALTER TABLE claim_action_file_seq
  DROP CONSTRAINT IF EXISTS claim_action_file_seq_file_type_check;

ALTER TABLE claim_action_file_seq
  ADD CONSTRAINT claim_action_file_seq_file_type_check
  CHECK (file_type IN ('EVI', 'DOC', 'CRO', 'FIR', 'DAN'));

-- 2. Actualizar la función next_file_seq para validar el nuevo tipo
CREATE OR REPLACE FUNCTION next_file_seq(
  p_claim_action_id UUID,
  p_file_type       TEXT
) RETURNS INT AS $$
DECLARE v_seq INT;
BEGIN
  IF p_file_type NOT IN ('EVI', 'DOC', 'CRO', 'FIR', 'DAN') THEN
    RAISE EXCEPTION 'Tipo de archivo inválido: % (debe ser EVI, DOC, CRO, FIR o DAN)', p_file_type;
  END IF;

  INSERT INTO claim_action_file_seq (claim_action_id, file_type, last_seq)
  VALUES (p_claim_action_id, p_file_type, 1)
  ON CONFLICT (claim_action_id, file_type)
  DO UPDATE SET last_seq = claim_action_file_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;
