-- ============================================================
-- Hub Inspections — Migración 263: email_logs — auditoría de plantilla
-- ============================================================
-- Almacena la versión ORIGINAL renderizada de la plantilla junto con
-- la versión FINAL enviada, para auditoría:
--   "la plantilla dijo X, pero el usuario lo modificó a Y"
--
-- Columnas nuevas:
--   template_subject      — asunto original de la plantilla (NULL si manual)
--   template_body         — body original renderizado (NULL si manual)
--   template_body_format  — formato original de la plantilla (NULL si manual)
--   was_modified          — TRUE si el usuario editó el subject o body
-- ============================================================

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS template_subject TEXT,
  ADD COLUMN IF NOT EXISTS template_body TEXT,
  ADD COLUMN IF NOT EXISTS template_body_format TEXT,
  ADD COLUMN IF NOT EXISTS was_modified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN email_logs.template_subject IS 'Asunto original renderizado desde la plantilla (NULL si modo manual)';
COMMENT ON COLUMN email_logs.template_body IS 'Body original renderizado desde la plantilla (NULL si modo manual)';
COMMENT ON COLUMN email_logs.template_body_format IS 'Formato original de la plantilla: plain o html (NULL si modo manual)';
COMMENT ON COLUMN email_logs.was_modified IS 'TRUE si el usuario modificó el subject o body respecto a la plantilla original';
