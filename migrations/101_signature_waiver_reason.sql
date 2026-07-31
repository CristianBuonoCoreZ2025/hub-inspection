-- ═══════════════════════════════════════════════════════════════
-- Migración 101 — Exención de firma del asegurado
-- ═══════════════════════════════════════════════════════════════
--
-- Permite que el inspector cierre una inspección remota sin la firma
-- del asegurado, registrando el motivo (ej: "Asegurado no disponible",
-- "Se niega a firmar", "Sin conexión").
--
-- Cuando signature_waiver_reason IS NOT NULL, el magic link se cierra
-- aunque el asegurado no haya firmado.
--
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS signature_waiver_reason TEXT;

INSERT INTO _migrations (filename) VALUES ('101_signature_waiver_reason.sql')
ON CONFLICT (filename) DO NOTHING;
