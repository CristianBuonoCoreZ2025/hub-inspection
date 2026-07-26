-- Migración 255: Agrega columna logo_position a email_templates
-- Permite controlar la posición del logo en el header del e-mail (left/center/right).
-- Los registros existentes quedan en 'center' (comportamiento previo).

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'center';

-- Validación: solo valores permitidos
ALTER TABLE email_templates
  ADD CONSTRAINT email_templates_logo_position_check
  CHECK (logo_position IS NULL OR logo_position IN ('left', 'center', 'right'));

-- Comentar la columna para documentación
COMMENT ON COLUMN email_templates.logo_position IS
  'Posición del logo en el header del e-mail: left, center o right. Default: center.';

-- Backfill: asegurar que NULL se interprete como 'center'
UPDATE email_templates SET logo_position = 'center' WHERE logo_position IS NULL;
