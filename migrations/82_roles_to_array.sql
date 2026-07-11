-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 82: Convert role fields to arrays (multiple roles per level)
-- Los roles por nivel no son excluyentes: un emisor puede ser
-- liquidador + inspector + asistente a la vez.
-- ═══════════════════════════════════════════════════════════════

-- Agregar columnas array
ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS issuer_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewer_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approver_roles text[] NOT NULL DEFAULT '{}';

-- Migrar datos existentes: convertir texto singular a array
UPDATE action_template
  SET issuer_roles = CASE
    WHEN issuer_role IS NOT NULL AND issuer_role != '' THEN ARRAY[issuer_role]
    ELSE '{}'
  END,
  reviewer_roles = CASE
    WHEN reviewer_role IS NOT NULL AND reviewer_role != '' THEN ARRAY[reviewer_role]
    ELSE '{}'
  END,
  approver_roles = CASE
    WHEN approver_role IS NOT NULL AND approver_role != '' THEN ARRAY[approver_role]
    ELSE '{}'
  END;
