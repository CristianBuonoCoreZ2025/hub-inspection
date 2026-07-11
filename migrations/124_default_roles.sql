-- 124_default_roles.sql
-- Agregar columnas para el rol por defecto de cada nivel del workflow.
-- Solo un rol puede ser el "por defecto" por nivel.
-- El rol por defecto determina qué persona del siniestro se auto-asigna al crear la gestión.

ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS default_issuer_role text,
  ADD COLUMN IF NOT EXISTS default_reviewer_role text,
  ADD COLUMN IF NOT EXISTS default_approver_role text;

COMMENT ON COLUMN action_template.default_issuer_role IS 'Rol por defecto para emisión. Determina qué persona del siniestro se auto-asigna al crear la gestión.';
COMMENT ON COLUMN action_template.default_reviewer_role IS 'Rol por defecto para revisión.';
COMMENT ON COLUMN action_template.default_approver_role IS 'Rol por defecto para aprobación.';
