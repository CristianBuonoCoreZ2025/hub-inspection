-- ═══════════════════════════════════════════════════════════════
-- Migración 102 — Agregar ai_analyzed_at a inspection_evidences
-- ═══════════════════════════════════════════════════════════════
--
-- La columna ai_analyzed_at existe en claim_images pero NO en
-- inspection_evidences. El query getInspectionPhotosByClaim la pide
-- en el SELECT, lo que causa un error 400 de PostgREST y las fotos
-- de inspección no aparecen en el siniestro.
--
-- Agregamos la columna para que el query funcione y el frontend
-- pueda mostrar la fecha de análisis de IA.
--
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

INSERT INTO _migrations (filename) VALUES ('102_inspection_evidences_ai_analyzed_at.sql')
ON CONFLICT (filename) DO NOTHING;
