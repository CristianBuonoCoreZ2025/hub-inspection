-- Migration 60: Add acta_step to inspection_sessions
-- Permite sincronizar el step interno del Acta del inspector con el cliente (magic link)
-- El cliente sigue automáticamente el step del Acta que el inspector está editando

ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS acta_step TEXT DEFAULT 'datos';
