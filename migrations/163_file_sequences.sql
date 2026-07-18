-- ═══════════════════════════════════════════════════════════════
-- Migration 163: Secuencias de correlativos para docs de siniestro,
--                 docs de póliza y templates de gestiones
-- ═══════════════════════════════════════════════════════════════
-- Complementa la migración 162 (claim_action_file_seq para archivos
-- de una gestión: EVI, DOC, FIR, DAN).
--
-- Esta migración cubre los correlativos que NO dependen de un
-- claim_action sino de otras entidades:
--   - claim_document_seq: docs del siniestro (DOC-NNNNNN, 6 dígitos)
--   - policy_document_seq: docs de póliza (DOC-NNNN, 4 dígitos)
--   - template_file_seq: templates de gestiones (NNNNN, 5 dígitos)
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Documentos del siniestro (DOC-NNNNNN, 6 dígitos) ═══

CREATE TABLE IF NOT EXISTS claim_document_seq (
  claim_id  UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  last_seq  INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (claim_id)
);

COMMENT ON TABLE claim_document_seq IS
  'Contador de correlativos de documento por siniestro (DOC-NNNNNN)';

CREATE OR REPLACE FUNCTION next_claim_doc_seq(p_claim_id UUID)
RETURNS INT AS $$
DECLARE v_seq INT;
BEGIN
  INSERT INTO claim_document_seq (claim_id, last_seq)
  VALUES (p_claim_id, 1)
  ON CONFLICT (claim_id)
  DO UPDATE SET last_seq = claim_document_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_claim_doc_seq(UUID) IS
  'Devuelve el siguiente correlativo atómico de documento de siniestro';

-- ═══ 2. Documentos de póliza (DOC-NNNN, 4 dígitos) ═══

CREATE TABLE IF NOT EXISTS policy_document_seq (
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  last_seq  INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (policy_id)
);

COMMENT ON TABLE policy_document_seq IS
  'Contador de correlativos de documento por póliza (DOC-NNNN)';

CREATE OR REPLACE FUNCTION next_policy_doc_seq(p_policy_id UUID)
RETURNS INT AS $$
DECLARE v_seq INT;
BEGIN
  INSERT INTO policy_document_seq (policy_id, last_seq)
  VALUES (p_policy_id, 1)
  ON CONFLICT (policy_id)
  DO UPDATE SET last_seq = policy_document_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_policy_doc_seq(UUID) IS
  'Devuelve el siguiente correlativo atómico de documento de póliza';

-- ═══ 3. Templates de gestiones (NNNNN, 5 dígitos por código compuesto) ═══

CREATE TABLE IF NOT EXISTS template_file_seq (
  composite_code TEXT NOT NULL,
  last_seq       INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (composite_code)
);

COMMENT ON TABLE template_file_seq IS
  'Contador de correlativos de template por código compuesto de gestión (NNNNN)';

CREATE OR REPLACE FUNCTION next_template_seq(p_composite_code TEXT)
RETURNS INT AS $$
DECLARE v_seq INT;
BEGIN
  INSERT INTO template_file_seq (composite_code, last_seq)
  VALUES (p_composite_code, 1)
  ON CONFLICT (composite_code)
  DO UPDATE SET last_seq = template_file_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_template_seq(TEXT) IS
  'Devuelve el siguiente correlativo atómico de template por código compuesto';
