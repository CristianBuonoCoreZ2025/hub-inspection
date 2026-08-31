-- ═══════════════════════════════════════════════════════════════
-- Migración 354: Marca comodín (is_wildcard) en damage_spaces
-- ═══════════════════════════════════════════════════════════════
--
-- Agrega columna is_wildcard a damage_spaces para identificar espacios
-- comodín (ej: "Otro") que no deben precargar medidas totales.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE damage_spaces
  ADD COLUMN IF NOT EXISTS is_wildcard BOOLEAN DEFAULT false;

-- Marcar "Otro" como comodín
UPDATE damage_spaces SET is_wildcard = true WHERE name = 'Otro';
