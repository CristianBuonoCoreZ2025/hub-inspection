-- Migration 59: Add active_tab to inspection_sessions
-- Permite sincronizar el tab activo del inspector con el cliente (magic link)
-- El cliente ve automáticamente lo que el inspector está viendo

ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS active_tab TEXT DEFAULT 'resumen';
