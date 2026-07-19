-- ═══════════════════════════════════════════════════════════════
-- Migration 174: Tabla claim_images + secuencia + permiso
-- ═══════════════════════════════════════════════════════════════
-- Tabla dedicada para imágenes subidas directamente al siniestro
-- (no a una inspección). Se distingue de claim_documents porque
-- estas son imágenes con optimización de tamaño + análisis IA,
-- mientras que claim_documents son documentos (PDFs, oficios, etc).
--
-- Las imágenes de inspección NO se guardan aquí — viven en
-- inspection_evidences. Este tab solo muestra las que se suben
-- directamente al siniestro + las de inspección (read-only).
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Tabla claim_images ═══

CREATE TABLE IF NOT EXISTS claim_images (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  img_code          TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  url               TEXT NOT NULL,
  original_filename TEXT,
  mime_type         TEXT,
  file_size         BIGINT,
  uploaded_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ai_summary        TEXT,
  ai_model          TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE claim_images IS
  'Imágenes subidas directamente al siniestro (tab Imágenes). Distintas de claim_documents (documentos) y de inspection_evidences (imágenes de inspección).';

COMMENT ON COLUMN claim_images.img_code IS
  'Código de la imagen, ej: L-000000141-IMG-000001';
COMMENT ON COLUMN claim_images.ai_summary IS
  'Resumen/descripción automático generado por IA (OpenRouter) al subir la imagen';
COMMENT ON COLUMN claim_images.ai_model IS
  'Modelo de IA usado para generar el resumen';
COMMENT ON COLUMN claim_images.is_active IS
  'Soft delete. Las imágenes se eliminan con is_active=false mientras el siniestro esté abierto.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_claim_images_claim_id ON claim_images(claim_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_claim_images_created_at ON claim_images(created_at DESC);

-- RLS
ALTER TABLE claim_images ENABLE ROW LEVEL SECURITY;

-- Política: todos los usuarios autenticados pueden ver imágenes del claim
CREATE POLICY claim_images_select ON claim_images
  FOR SELECT TO authenticated
  USING (true);

-- Política: insert solo usuarios autenticados
CREATE POLICY claim_images_insert ON claim_images
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Política: update solo usuarios autenticados
CREATE POLICY claim_images_update ON claim_images
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política: delete solo via service role (soft delete desde API)
CREATE POLICY claim_images_delete ON claim_images
  FOR DELETE TO service_role
  USING (true);

-- ═══ 2. Secuencia de correlativos IMG-NNNNNN ═══

CREATE TABLE IF NOT EXISTS claim_image_seq (
  claim_id  UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  last_seq  INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (claim_id)
);

COMMENT ON TABLE claim_image_seq IS
  'Contador de correlativos de imagen por siniestro (IMG-NNNNNN)';

CREATE OR REPLACE FUNCTION next_claim_image_seq(p_claim_id UUID)
RETURNS INT AS $$
DECLARE v_seq INT;
BEGIN
  INSERT INTO claim_image_seq (claim_id, last_seq)
  VALUES (p_claim_id, 1)
  ON CONFLICT (claim_id)
  DO UPDATE SET last_seq = claim_image_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_claim_image_seq(UUID) IS
  'Devuelve el siguiente correlativo atómico de imagen de siniestro (IMG-NNNNNN)';

-- ═══ 3. Permiso claims_imagenes para todos los user_types ═══

INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
SELECT ut, 'claims_imagenes', true, true, true, true
FROM (VALUES
  ('internal'),
  ('adjuster'),
  ('inspector'),
  ('assistant'),
  ('auditor'),
  ('dispatcher')
) AS t(ut)
WHERE NOT EXISTS (
  SELECT 1 FROM user_type_permissions p
  WHERE p.user_type = t.ut AND p.section = 'claims_imagenes'
);
