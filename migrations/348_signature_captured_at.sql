-- ═══════════════════════════════════════════════════════════════
-- Migración 348: Captura de firma del asegurado
-- ═══════════════════════════════════════════════════════════════
-- Objetivo: Permitir que el inspector "capture" la firma del asegurado,
-- bloqueando que el asegurado pueda volver a firmar desde el Magic Link.
--
-- - signature_captured_at: fecha/hora en que el inspector capturó la firma
--   NULL = no capturada, el asegurado puede seguir firmando
--   NOT NULL = firma capturada, el asegurado ya no puede firmar
--
-- También se bloquea cuando la inspección está completed/cancelled.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS signature_captured_at timestamptz;

-- Verificación
-- SELECT id, inspection_number, status, signature_captured_at
-- FROM inspection_sessions
-- WHERE status = 'completed'
-- ORDER BY ended_at DESC LIMIT 10;
