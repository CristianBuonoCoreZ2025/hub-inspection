-- ═══════════════════════════════════════════════════════════════
-- Migration 222: Configuración de auto-emisión y auto-email
--
-- Agrega a action_template:
--  - auto_email_recipients: tipos de destinatarios para envío automático
--  - auto_field_mapping: mapeo de campos de pantalla a valores del sistema
--    para completar la gestión automáticamente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS auto_email_recipients TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb;
