-- ═══════════════════════════════════════════════════════════════
-- Migration 162: Secuencias de correlativos de archivo por gestión
-- ═══════════════════════════════════════════════════════════════
-- Cada archivo subido a una gestión (evidencia, documento, firma, daño)
-- necesita un correlativo único por gestión + tipo de archivo.
--
-- Ej: L-000000141-HINS-001-EVI-0001, L-000000141-HINS-001-EVI-0002
--     L-000000141-HINS-001-DOC-0001, L-000000141-HINS-001-FIR-0001
--
-- Usamos una tabla contadora con INSERT ... ON CONFLICT DO UPDATE
-- para garantizar atomicidad incluso con inserts concurrentes.
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla contadora de correlativos por gestión + tipo
CREATE TABLE IF NOT EXISTS claim_action_file_seq (
  claim_action_id UUID NOT NULL REFERENCES claim_actions(id) ON DELETE CASCADE,
  file_type       TEXT NOT NULL CHECK (file_type IN ('EVI', 'DOC', 'FIR', 'DAN')),
  last_seq        INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (claim_action_id, file_type)
);

COMMENT ON TABLE claim_action_file_seq IS
  'Contador de correlativos de archivo por gestión + tipo (EVI, DOC, FIR, DAN)';

-- 2. Función atómica para obtener el siguiente correlativo
-- Llamar desde el server-side antes de subir cada archivo.
CREATE OR REPLACE FUNCTION next_file_seq(
  p_claim_action_id UUID,
  p_file_type       TEXT
) RETURNS INT AS $$
DECLARE v_seq INT;
BEGIN
  IF p_file_type NOT IN ('EVI', 'DOC', 'FIR', 'DAN') THEN
    RAISE EXCEPTION 'Tipo de archivo inválido: % (debe ser EVI, DOC, FIR o DAN)', p_file_type;
  END IF;

  INSERT INTO claim_action_file_seq (claim_action_id, file_type, last_seq)
  VALUES (p_claim_action_id, p_file_type, 1)
  ON CONFLICT (claim_action_id, file_type)
  DO UPDATE SET last_seq = claim_action_file_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_file_seq(UUID, TEXT) IS
  'Devuelve el siguiente correlativo atómico para un archivo de una gestión';
